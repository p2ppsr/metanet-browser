//
//  NotificationService.swift
//  MetanetNotificationService
//
//  Created by Brayden Langley on 8/8/25.
//  Updated with structured logging, fetch polyfills, byte-accurate base64, atob/btoa shims, UTF-8 TextEncoder/Decoder, and abortable native fetch.
//
import UserNotifications
import JavaScriptCore
import os
import CryptoKit


// ADD: Lightweight timer center for JS setTimeout/setInterval
private final class JSTimerCenter {
  private let logger: Logger
  private let vm: JSVirtualMachine
  private unowned let ctx: JSContext
  private let lock = NSLock()
  private var nextId: Int = 1
  private var timers: [Int: DispatchSourceTimer] = [:]
  private var callbacks: [Int: JSManagedValue] = [:]
  private var argsById: [Int: [Any]] = [:]
  private var repeatsById: [Int: Bool] = [:]

  init(logger: Logger, vm: JSVirtualMachine, ctx: JSContext) {
    self.logger = logger
    self.vm = vm
    self.ctx = ctx
  }

  
  @discardableResult
  func set(ms: Int, repeats: Bool, callback: JSValue, args: [Any]) -> Int {
    let delay = max(0, ms)
    let interval = max(1, ms)

    lock.lock()
    let id = nextId
    nextId += 1
    let managed = JSManagedValue(value: callback)
    vm.addManagedReference(managed, withOwner: self)
    callbacks[id] = managed
    argsById[id] = args
    repeatsById[id] = repeats
    lock.unlock()

    let q = DispatchQueue.global(qos: .utility)
    let timer = DispatchSource.makeTimerSource(queue: q)

    let start = DispatchTime.now() + .milliseconds(delay)
    if repeats {
      timer.schedule(deadline: start, repeating: .milliseconds(interval))
    } else {
      // schedule with any repeating value; we'll cancel on first fire
      timer.schedule(deadline: start, repeating: .milliseconds(interval))
    }

    timer.setEventHandler { [weak self] in
      guard let self = self else { return }
      self.lock.lock()
      let managed = self.callbacks[id]
      let args = self.argsById[id] ?? []
      let repeatFlag = self.repeatsById[id] ?? false
      self.lock.unlock()

      if let cb = managed?.value {
        _ = cb.call(withArguments: args)
      }

      if !repeatFlag {
        self.clear(id: id)
      }
    }

    lock.lock()
    timers[id] = timer
    lock.unlock()

    timer.resume()
    logger.debug("JSTimerCenter started id=\(id) ms=\(ms) repeats=\(repeats)")
    return id
  }

  func clear(id: Int) {
    lock.lock()
    let t = timers.removeValue(forKey: id)
    let managed = callbacks.removeValue(forKey: id)
    argsById.removeValue(forKey: id)
    repeatsById.removeValue(forKey: id)
    lock.unlock()
    t?.cancel()
    if let m = managed { vm.removeManagedReference(m, withOwner: self) }
    logger.debug("JSTimerCenter cleared id=\(id)")
  }

  func clearAll() {
    lock.lock()
    let allTimers = timers.values
    timers.removeAll()
    let allManaged = callbacks.values
    callbacks.removeAll()
    argsById.removeAll()
    repeatsById.removeAll()
    lock.unlock()
    for t in allTimers { t.cancel() }
    for m in allManaged { vm.removeManagedReference(m, withOwner: self) }
    logger.debug("JSTimerCenter cleared all timers")
  }
}

private let APP_GROUP_ID = "group.org.bsvblockchain.metanet"
private let SNAP_KEY = "snap"

final class NotificationService: UNNotificationServiceExtension {
  enum CompletionReason: String {
    case success, jsRejected, jsMissingRun, jsNoPromise, jsException,
         loadJSBundleFailed, invalidRequestContent, timeout,
         invalidURL, networkError, noHTTPResponse
  }

  private let logger = Logger(subsystem: Bundle.main.bundleIdentifier ?? "org.bsvblockchain.metanet",
                              category: "NSE")

  // Track in-flight URLSessionTasks so we can cancel from JS (AbortController)
  private let tasksLock = NSLock()
  private var tasks: [String: URLSessionTask] = [:]
  
  // Timer registry (for setTimeout / setInterval)
  private let timersLock = NSLock()
  private var timers: [String: DispatchSourceTimer] = [:]
  private var jsTimerCenter: JSTimerCenter?

  var contentHandler: ((UNNotificationContent) -> Void)?
  var bestAttemptContent: UNMutableNotificationContent?

  override func didReceive(_ request: UNNotificationRequest,
                           withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void) {
    let start = Date()
    let reqID = UUID().uuidString

    func msElapsed() -> Int { Int(Date().timeIntervalSince(start) * 1000) }

    self.contentHandler = contentHandler
    let threadName = Thread.isMainThread ? "main" : "bg"
    logger.info("didReceive start id=\(reqID, privacy: .public) identifier=\(request.identifier, privacy: .public) thread=\(threadName, privacy: .public)")

    guard let best = (request.content.mutableCopy() as? UNMutableNotificationContent) else {
      logger.error("Mutable copy of request content failed; returning original. id=\(reqID, privacy: .public)")
      contentHandler(request.content)
      return
    }

    // Make sure serviceExtensionTimeWillExpire() can return something
    self.bestAttemptContent = best

    // A small completion gate to ensure we only finish once
    let lock = NSLock()
    var completed = false
    func complete(_ reason: CompletionReason) {
      lock.lock(); defer { lock.unlock() }
      guard !completed else { return }
      completed = true
      logger.info("Completing id=\(reqID, privacy: .public) reason=\(reason.rawValue, privacy: .public) elapsedMs=\(msElapsed())")
      if let ch = self.contentHandler {
        ch(self.bestAttemptContent ?? best)
      }
    }

    // Ephemeral session for the NSE
    let cfg = URLSessionConfiguration.ephemeral
    cfg.timeoutIntervalForRequest = 20
    cfg.timeoutIntervalForResource = 25
    cfg.waitsForConnectivity = false
    let session = URLSession(configuration: cfg)
    let waits = cfg.waitsForConnectivity ? "true" : "false"
    logger.debug("URLSession configured requestTimeout=\(cfg.timeoutIntervalForRequest, privacy: .public)s resourceTimeout=\(cfg.timeoutIntervalForResource, privacy: .public)s waitsForConnectivity=\(waits, privacy: .public)")

    // One JS VM + context
    let vm = JSVirtualMachine()
    let ctx = JSContext(virtualMachine: vm)!
    
    // ADD: instantiate timer center
    self.jsTimerCenter = JSTimerCenter(logger: logger, vm: vm!, ctx: ctx)

    // ADD: native timer bridges
    let _setTimerNative: @convention(block) (Int, JSValue, Bool, JSValue?) -> Int = { [weak self] ms, fn, repeats, argsVal in
      guard let self = self, let center = self.jsTimerCenter else { return 0 }
      let args = argsVal?.toArray() ?? []
      return center.set(ms: ms, repeats: repeats, callback: fn, args: args)
    }
    let _clearTimerNative: @convention(block) (Int) -> Void = { [weak self] id in
      guard let self = self, let center = self.jsTimerCenter else { return }
      center.clear(id: id)
    }
    ctx.setObject(_setTimerNative, forKeyedSubscript: "_setTimerNative" as NSString)
    ctx.setObject(_clearTimerNative, forKeyedSubscript: "_clearTimerNative" as NSString)

    // Log JS exceptions
    ctx.exceptionHandler = { [weak self] _, exc in
      self?.logger.error("JS exception id=\(reqID, privacy: .public): \(String(describing: exc), privacy: .public)")
    }

    // ---- Globals ----
    if let g = ctx.globalObject {
      g.setValue(g, forProperty: "globalThis")
      g.setValue(g, forProperty: "self")
      g.setValue(g, forProperty: "window")
    }

    // ---- console bridge: support log/debug/info/warn/error/trace/time/timeEnd/group/groupCollapsed/groupEnd/assert/dir ----
    let nativeConsole: @convention(block) (String, String) -> Void = { [weak self] level, message in
      guard let self = self else { return }
      // TEMPORARY: Use .error for all messages to ensure visibility during debugging
      switch level.lowercased() {
      case "error":
        self.logger.error("[JS][error] \(message, privacy: .public)")
      case "warn":
        self.logger.error("[JS][warn] \(message, privacy: .public)")     // Elevated to error
      case "info", "log":
        self.logger.error("[JS][info] \(message, privacy: .public)")     // Elevated to error
      case "debug":
        self.logger.error("[JS][debug] \(message, privacy: .public)")    // Elevated to error
      case "trace":
        self.logger.error("[JS][trace] \(message, privacy: .public)")    // Elevated to error
      case "time":
        self.logger.error("[JS][time] \(message, privacy: .public)")     // Elevated to error
      case "group", "groupcollapsed":
        self.logger.error("[JS][group] \(message, privacy: .public)")    // Elevated to error
      case "groupend":
        self.logger.error("[JS][groupEnd] \(message, privacy: .public)") // Elevated to error
      case "assert":
        self.logger.error("[JS][assert] \(message, privacy: .public)")
      case "dir":
        self.logger.error("[JS][dir] \(message, privacy: .public)")      // Elevated to error
      default:
        self.logger.error("[JS][\(level, privacy: .public)] \(message, privacy: .public)")  // Elevated to error
      }
    }
    ctx.setObject(nativeConsole, forKeyedSubscript: "_consoleNative" as NSString)

    ctx.evaluateScript(#"""
    (function(){
      function format(arg){
        try {
          if (typeof arg === 'string') return arg;
          if (typeof arg === 'number' || typeof arg === 'boolean' || arg == null) return String(arg);
          if (arg && (arg.stack || arg.message)) {
            // Format error objects with full details
            var parts = [];
            if (arg.name) parts.push(arg.name + ':');
            if (arg.message) parts.push(arg.message);
            if (arg.stack) parts.push('\nStack trace:\n' + arg.stack);
            return parts.join(' ');
          }
          try { return JSON.stringify(arg, null, 2); } catch(_) { return String(arg); }
        } catch(e) { return String(arg); }
      }
      function send(level){
        var args = Array.prototype.slice.call(arguments, 1);
        var msg;
        try { msg = args.map(format).join(' '); } catch(e) { msg = String(args); }
        try { _consoleNative(String(level), String(msg)); } catch(e) { /* ignore */ }
      }
      if (!globalThis.console) globalThis.console = {};
      var c = globalThis.console;
      c.log = function(){ send('log', ...arguments); };
      c.debug = function(){ send('debug', ...arguments); };
      c.info = function(){ send('info', ...arguments); };
      c.warn = function(){ send('warn', ...arguments); };
      c.error = function(){ send('error', ...arguments); };
      c.trace = function(){
        var parts = Array.prototype.slice.call(arguments);
        try { parts.push(new Error().stack || ''); } catch(_){ }
        send('trace', ...parts);
      };
      const _timers = new Map();
      c.time = function(label){ label = label || 'default'; try { _timers.set(label, Date.now()); } catch(_){ } };
      c.timeEnd = function(label){ label = label || 'default'; try { var t = _timers.get(label); if (typeof t === 'number') { send('time', label + ': ' + (Date.now()-t) + 'ms'); _timers.delete(label); } } catch(_){ } };
      c.group = function(){ send('group', ...arguments); };
      c.groupCollapsed = function(){ send('groupCollapsed', ...arguments); };
      c.groupEnd = function(){ send('groupEnd'); };
      c.assert = function(cond){ if (!cond) { var args = Array.prototype.slice.call(arguments, 1); if (!args.length) args = ['Assertion failed']; send('assert', ...args); } };
      c.dir = function(obj){ try { send('dir', JSON.stringify(obj)); } catch(_) { send('dir', String(obj)); } };
    })();
    """#)

    // ---- Byte-accurate base64 helpers (available early) ----
    ctx.evaluateScript(#"""
    (function(){
      if (!globalThis.__b64) {
        const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
        const LUT = (function(){
          const t = new Int16Array(128); for (let i=0;i<t.length;i++) t[i] = -1;
          for (let i=0;i<ABC.length;i++) t[ABC.charCodeAt(i)] = i;
          return t;
        })();

    function toU8(b64){
      b64 = String(b64).replace(/[^A-Za-z0-9+/=]/g, '');
      const len = b64.length;
      const outLen = ((len * 3) >> 2) - (b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0);
      const out = new Uint8Array(outLen);
      let o = 0;

      for (let i = 0; i < len; i += 4) {
        const c1 = LUT[b64.charCodeAt(i)];
        const c2 = LUT[b64.charCodeAt(i + 1)];
        const p3 = b64[i + 2] === '=';
        const p4 = b64[i + 3] === '=';
        const c3 = p3 ? 0 : LUT[b64.charCodeAt(i + 2)];
        const c4 = p4 ? 0 : LUT[b64.charCodeAt(i + 3)];

        // (optional) basic validation
        // if (c1 < 0 || c2 < 0 || (!p3 && c3 < 0) || (!p4 && c4 < 0)) throw new Error('bad base64');

        const x = (c1 << 18) | (c2 << 12) | (c3 << 6) | c4;

        out[o++] = (x >>> 16) & 255;
        if (!p3) out[o++] = (x >>> 8) & 255;
        if (!p4) out[o++] = x & 255;
      }
      return out;
    }



        function fromU8(u8){
          let out = '';
          let i = 0;
          for (; i + 2 < u8.length; i += 3){
            const x = (u8[i]<<16) | (u8[i+1]<<8) | u8[i+2];
            out += ABC[(x>>>18)&63] + ABC[(x>>>12)&63] + ABC[(x>>>6)&63] + ABC[x&63];
          }
          if (i < u8.length){
            let x = u8[i]<<16;
            out += ABC[(x>>>18)&63] + ABC[(x>>>12)&63];
            if (i + 1 < u8.length){
              x |= u8[i+1]<<8;
              out += ABC[(x>>>6)&63] + '=';
            } else {
              out += '==';
            }
          }
          return out;
        }

        globalThis.__b64 = { toU8: toU8, fromU8: fromU8 };
      }
    })();
    """#)

    // ---- Polyfills: TextEncoder/Decoder (UTF-8 correct) + atob/btoa ----
    ctx.evaluateScript(#"""
    (function(){
      if (typeof TextEncoder === 'undefined') {
        class TextEncoder {
          encode(str){
            var out = [], i = 0, len = str.length;
            while (i < len) {
              var c = str.charCodeAt(i++);
              // surrogate pair
              if (c >= 0xD800 && c <= 0xDBFF && i < len) {
                var c2 = str.charCodeAt(i++);
                var cp = ((c - 0xD800) << 10) + (c2 - 0xDC00) + 0x10000;
                out.push(0xF0 | (cp >> 18),
                         0x80 | ((cp >> 12) & 63),
                         0x80 | ((cp >> 6) & 63),
                         0x80 | (cp & 63));
              } else if (c < 0x80) {
                out.push(c);
              } else if (c < 0x800) {
                out.push(0xC0 | (c >> 6),
                         0x80 | (c & 63));
              } else {
                out.push(0xE0 | (c >> 12),
                         0x80 | ((c >> 6) & 63),
                         0x80 | (c & 63));
              }
            }
            return new Uint8Array(out);
          }
        }
        globalThis.TextEncoder = TextEncoder;
      }
      if (typeof TextDecoder === 'undefined') {
        class TextDecoder {
          decode(u8){
            var out = "", i = 0, c = 0, c2 = 0, c3 = 0, c4 = 0;
            while (i < u8.length) {
              c = u8[i++];
              if (c < 0x80) { out += String.fromCharCode(c); }
              else if (c < 0xE0) { c2 = u8[i++]; out += String.fromCharCode(((c & 31) << 6) | (c2 & 63)); }
              else if (c < 0xF0) { c2 = u8[i++]; c3 = u8[i++]; out += String.fromCharCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63)); }
              else { c2 = u8[i++]; c3 = u8[i++]; c4 = u8[i++]; var cp = ((c & 7) << 18) | ((c2 & 63) << 12) | ((c3 & 63) << 6) | (c4 & 63); cp -= 0x10000; out += String.fromCharCode(0xD800 + (cp >> 10), 0xDC00 + (cp & 0x3FF)); }
            }
            return out;
          }
        }
        globalThis.TextDecoder = TextDecoder;
      }

      // Spec-correct atob/btoa for binary strings (use byte-accurate base64)
      if (typeof atob !== 'function') {
        globalThis.atob = function(b64){
          var u8 = __b64.toU8(String(b64));
          var s = '';
          for (var i=0;i<u8.length;i++) s += String.fromCharCode(u8[i]);
          return s;
        };
      }
      if (typeof btoa !== 'function') {
        globalThis.btoa = function(bin){
          bin = String(bin);
          var u8 = new Uint8Array(bin.length);
          for (var i=0;i<bin.length;i++) u8[i] = bin.charCodeAt(i) & 0xFF;
          return __b64.fromU8(u8);
        };
      }
    })();
    """#)

    // ---- URL & URLSearchParams polyfill (WHATWG-lite for NSE) ----
    ctx.evaluateScript(#"""
    (function(){
      if (typeof URLSearchParams === 'undefined') {
        class URLSearchParams {
          constructor(init){
            this._map = new Map();
            if (!init) return;
            if (typeof init === 'string') {
              var s = init.charAt(0) === '?' ? init.slice(1) : init;
              if (s) {
                s.split('&').forEach(function(part){
                  if (!part) return;
                  var kv = part.split('=');
                  var k = decodeURIComponent(kv[0].replace(/\+/g, ' '));
                  var v = decodeURIComponent((kv[1]||'').replace(/\+/g, ' '));
                  var list = this._map.get(k); if (list) list.push(v); else this._map.set(k, [v]);
                }, this);
              }
            } else if (typeof init === 'object') {
              for (var key in init) if (Object.prototype.hasOwnProperty.call(init, key)) this.append(key, init[key]);
            }
          }
          append(k,v){ k=String(k); v=String(v); var list=this._map.get(k); if (list) list.push(v); else this._map.set(k,[v]); }
          set(k,v){ this._map.set(String(k), [String(v)]); }
          get(k){ var list=this._map.get(String(k)); return list? list[0]: null; }
          getAll(k){ var list=this._map.get(String(k)); return list? list.slice(): []; }
          has(k){ return this._map.has(String(k)); }
          delete(k){ this._map.delete(String(k)); }
          forEach(cb, thisArg){ this._map.forEach(function(list, k){ list.forEach(function(v){ cb.call(thisArg, v, k, this); }, this); }, this); }
          toString(){
            var enc = encodeURIComponent, out=[];
            this._map.forEach(function(list, k){ list.forEach(function(v){ out.push(enc(k)+'='+enc(v)); }); });
            return out.join('&');
          }
          [Symbol.iterator](){ var a=[]; this.forEach(function(v,k){ a.push([k,v]); }); return a[Symbol.iterator](); }
          keys(){ var a=[]; this.forEach(function(_,k){ a.push(k); }); return a[Symbol.iterator](); }
          values(){ var a=[]; this.forEach(function(v){ a.push(v); }); return a[Symbol.iterator](); }
          entries(){ return this[Symbol.iterator](); }
        }
        globalThis.URLSearchParams = URLSearchParams;
      }

      if (typeof URL === 'undefined') {
        class URL {
          constructor(input, base){
            if (input == null) throw new TypeError('Invalid URL');
            var href = String(input);
            if (base) {
              var b = new URL(String(base));
              if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(href)) {
                if (href.indexOf('//') === 0)      href = b.protocol + href;
                else if (href.charAt(0) === '/')   href = b.origin + href;
                else {
                  var path = b.pathname.replace(/[^\/]*$/, '');
                  href = b.origin + path + href;
                }
              }
            }
            var m = href.match(/^([a-zA-Z][a-zA-Z0-9+.-]*:)?(\/\/)?([^\/\?#]*)?([^?#]*)?(?:\?([^#]*))?(?:#(.*))?$/);
            if (!m) throw new TypeError('Invalid URL');
            this.protocol = (m[1] || '').toLowerCase();
            var host = m[3] || '';
            var hostname = host, port = '';
            var idx = host.lastIndexOf(':');
            if (idx > -1 && host.indexOf(']') < idx) { hostname = host.slice(0, idx); port = host.slice(idx+1); }
            this.hostname = hostname;
            this.port = port;
            this.host = hostname + (port ? (':' + port) : '');
            this.pathname = m[4] || '';
            this.search = m[5] ? ('?' + m[5]) : '';
            this.hash = m[6] ? ('#' + m[6]) : '';
            this.searchParams = new URLSearchParams(m[5] || '');
            this.username = '';
            this.password = '';
            this.origin = (this.protocol && this.host) ? (this.protocol + '//' + this.host) : '';
            this.href = this.toString();
          }
          toString(){
            var auth = this.username || this.password ? (this.username + (this.password? ':'+this.password:'') + '@') : '';
            var base = (this.protocol || '') + '//' + auth + this.host;
            var q = this.searchParams && typeof this.searchParams.toString === 'function' ? this.searchParams.toString() : (this.search && this.search[0]==='?' ? this.search.slice(1) : this.search);
            var search = q ? ('?' + q) : '';
            return base + (this.pathname || '') + search + (this.hash || '');
          }
        }
        globalThis.URL = URL;
      }
    })();
    """#)
    
    // ADD: setTimeout/clearTimeout/setInterval/clearInterval shims
       ctx.evaluateScript(#"""
       (function(){
         if (typeof setTimeout === 'undefined') {
           globalThis.setTimeout = function(handler, timeout){
             var fn = (typeof handler === 'function') ? handler : function(){ try { eval(String(handler)); } catch(e){ console.error(e); } };
             var ms = (timeout|0);
             var args = Array.prototype.slice.call(arguments, 2);
             try { return _setTimerNative(ms, fn, false, args); } catch (e) { console.error(e); return 0; }
           };
           globalThis.clearTimeout = function(id){
             try { _clearTimerNative(id|0); } catch(_) {}
           };
           globalThis.setInterval = function(handler, timeout){
             var fn = (typeof handler === 'function') ? handler : function(){ try { eval(String(handler)); } catch(e){ console.error(e); } };
             var ms = (timeout|0);
             var args = Array.prototype.slice.call(arguments, 2);
             try { return _setTimerNative(ms, fn, true, args); } catch (e) { console.error(e); return 0; }
           };
           globalThis.clearInterval = function(id){
             try { _clearTimerNative(id|0); } catch(_) {}
           };
         }
       })();
       """#)

    // ---- Native fetch with abort support (URLSession) ----
    let nativeFetch2: @convention(block) (String, String, JSValue?, JSValue, JSValue) -> Void = { [weak self] opId, urlStr, initVal, resolve, reject in
      guard let self = self else { return }
      guard let url = URL(string: urlStr) else {
        _ = reject.call(withArguments: ["Invalid URL"])
        self.logger.error("nativeFetch2 invalid URL: \(urlStr, privacy: .public) opId=\(opId, privacy: .public)")
        return
      }
      var req = URLRequest(url: url)
      req.httpMethod = (initVal?.forProperty("method").toString() ?? "GET")
      req.timeoutInterval = 20

      if let headersObj = initVal?.forProperty("headers"), let dict = headersObj.toDictionary() as? [String: Any] {
        for (k,v) in dict { req.setValue(String(describing: v), forHTTPHeaderField: k) }
      }
      if let bodyVal = initVal?.forProperty("body"), !bodyVal.isUndefined {
        if bodyVal.isString, let s = bodyVal.toString() {
          if s.hasPrefix("base64:") { let b64 = String(s.dropFirst(7)); req.httpBody = Data(base64Encoded: b64) }
          else { req.httpBody = s.data(using: .utf8) }
        }
      }

      self.logger.debug("nativeFetch2 → \(req.httpMethod ?? "GET", privacy: .public) \(url.absoluteString, privacy: .public) opId=\(opId, privacy: .public)")

      let task = session.dataTask(with: req) { data, resp, err in
        // remove from registry
        self.tasksLock.lock(); self.tasks.removeValue(forKey: opId); self.tasksLock.unlock()

        if let err = err {
          _ = reject.call(withArguments: [String(describing: err)])
          self.logger.error("nativeFetch2 network error: \(String(describing: err), privacy: .public) opId=\(opId, privacy: .public)")
          return
        }
        guard let http = resp as? HTTPURLResponse else {
          _ = reject.call(withArguments: ["No response"])
          self.logger.error("nativeFetch2 missing HTTPURLResponse opId=\(opId, privacy: .public)")
          return
        }
        let headers = http.allHeaderFields.reduce(into: [String:String]()) { acc, kv in
          acc[String(describing: kv.key).lowercased()] = String(describing: kv.value)
        }
        self.logger.debug("nativeFetch2 ← status=\(http.statusCode) bytes=\(data?.count ?? 0) opId=\(opId, privacy: .public)")
        
        // For JSON/text responses, pass body directly as string
        var result: [String: Any] = [
          "status": http.statusCode,
          "statusText": HTTPURLResponse.localizedString(forStatusCode: http.statusCode),
          "ok": (200...299).contains(http.statusCode),
          "url": http.url?.absoluteString ?? urlStr,
          "headers": headers
        ]
        
        // Always set a body field to prevent null body issues
        if let data = data, !data.isEmpty {
          self.logger.debug("nativeFetch2 processing response data: \(data.count) bytes")
          
          // Always override content-type to application/json and return as string
          result["headers"] = headers.merging(["content-type": "application/json"]) { $1 }
          
          if let bodyString = String(data: data, encoding: .utf8) {
            self.logger.debug("nativeFetch2 UTF-8 decode success: \(bodyString.count) chars, preview: \(String(bodyString.prefix(100)))")
            result["body"] = bodyString
          } else {
            // UTF-8 decode failed - try base64 encoding as fallback
            let base64String = data.base64EncodedString()
            self.logger.error("nativeFetch2 UTF-8 decode failed, using base64: \(base64String.count) chars")
            result["body"] = ""  // Set empty string instead of missing key
            result["bodyBase64"] = base64String
          }
        } else {
          // No data or empty data - always set empty body
          self.logger.debug("nativeFetch2 no data, setting empty body")
          result["body"] = ""
        }
        _ = resolve.call(withArguments: [result])
      }

      // register task and start
      self.tasksLock.lock(); self.tasks[opId] = task; self.tasksLock.unlock()
      task.resume()
    }
    ctx.setObject(nativeFetch2, forKeyedSubscript: "_nativeFetch2" as NSString)

    let nativeFetchCancel: @convention(block) (String) -> Void = { [weak self] opId in
      guard let self = self else { return }
      self.tasksLock.lock(); let task = self.tasks.removeValue(forKey: opId); self.tasksLock.unlock()
      if let task = task {
        self.logger.debug("nativeFetch cancel opId=\(opId, privacy: .public)")
        task.cancel()
      }
    }
    ctx.setObject(nativeFetchCancel, forKeyedSubscript: "_nativeFetchCancel" as NSString)

    // ---- Fetch polyfills: AbortController, Headers, Blob, Request, Response, fetch (uses __b64 + UTF-8 TD/TE) ----
    ctx.evaluateScript(#"""
    (function(){
      function isArrayBuffer(v){ return (v && v.byteLength !== undefined && v.constructor && v.constructor.name === 'ArrayBuffer'); }
      function isView(v){ return v && v.buffer && v.byteLength !== undefined && v.constructor && /Array$/.test(v.constructor.name); }

      // AbortController / AbortSignal (minimal)
      if (typeof AbortSignal === 'undefined') {
        class AbortSignal {
          constructor(){ this.aborted = false; this._listeners = []; }
          addEventListener(type, fn){ if (type === 'abort' && typeof fn === 'function') this._listeners.push(fn); }
          removeEventListener(type, fn){ if (type !== 'abort') return; var i=this._listeners.indexOf(fn); if (i>=0) this._listeners.splice(i,1); }
          _dispatch(){ if (this.aborted) return; this.aborted = true; var ev = { type: 'abort' }; var list = this._listeners.slice(); for (var i=0;i<list.length;i++){ try{ list[i](ev); }catch(_){} } }
        }
        class AbortController { constructor(){ this.signal = new AbortSignal(); } abort(){ this.signal._dispatch(); } }
        globalThis.AbortSignal = AbortSignal; globalThis.AbortController = AbortController;
      }

      // Headers
      if (typeof Headers === 'undefined') {
        class Headers {
          constructor(init){ this._map = new Map(); if (init) {
            if (init instanceof Headers) init.forEach((v,k)=>this.set(k,v));
            else if (Array.isArray(init)) { for (var i=0;i<init.length;i++){ this.append(init[i][0], init[i][1]); } }
            else { for (var k in init) if (Object.prototype.hasOwnProperty.call(init,k)) this.append(k, init[k]); }
          }}
          _norm(name){ return String(name).toLowerCase(); }
          append(name, value){ name=this._norm(name); value=String(value); const list=this._map.get(name); if (list) list.push(value); else this._map.set(name,[value]); }
          set(name, value){ this._map.set(this._norm(name), [String(value)]); }
          get(name){ const list=this._map.get(this._norm(name)); return list? list[0]: null; }
          getAll(name){ const list=this._map.get(this._norm(name)); return list? list.slice(): []; }
          has(name){ return this._map.has(this._norm(name)); }
          delete(name){ this._map.delete(this._norm(name)); }
          forEach(cb, thisArg){ this._map.forEach((list,k)=>list.forEach(v=>cb.call(thisArg, v, k, this))); }
          keys(){ return this._map.keys(); }
          values(){ const self=this; return (function*(){ for (const [k,vs] of self._map) for (const v of vs) yield v; })(); }
          entries(){ const self=this; return (function*(){ for (const [k,vs] of self._map) for (const v of vs) yield [k,v]; })(); }
          [Symbol.iterator](){ return this.entries(); }
          toObject(){ const obj={}; this._map.forEach((list,k)=>{ obj[k]=list.join(', '); }); return obj; }
        }
        globalThis.Headers = Headers;
      }

      // Blob (minimal)
      if (typeof Blob === 'undefined') {
        class Blob {
          constructor(parts, options){
            parts = parts || [];
            this.type = options && options.type ? String(options.type) : '';
            var chunks = [];
            for (var i=0;i<parts.length;i++){
              var p = parts[i];
              if (typeof p === 'string') {
                var enc = new TextEncoder(); chunks.push(enc.encode(p));
              } else if (isArrayBuffer(p)) {
                chunks.push(new Uint8Array(p));
              } else if (isView(p)) {
                chunks.push(new Uint8Array(p.buffer, p.byteOffset, p.byteLength));
              } else if (p && typeof p === 'object' && p.constructor && p.constructor.name === 'Blob') {
                chunks.push(new Uint8Array(p._bytes));
              } else {
                var enc2 = new TextEncoder(); chunks.push(enc2.encode(String(p)));
              }
            }
            var len = chunks.reduce((n,a)=>n+a.length,0); var u8 = new Uint8Array(len); var off=0;
            for (var j=0;j<chunks.length;j++){ u8.set(chunks[j], off); off+=chunks[j].length; }
            this._bytes = u8;
            this.size = u8.length;
          }
          arrayBuffer(){ return Promise.resolve(this._bytes.buffer.slice(0)); }
          text(){ return Promise.resolve(new TextDecoder().decode(this._bytes)); }
          slice(start, end, type){ var s=(start||0)|0; var e=end==null? this._bytes.length : end|0; var u=this._bytes.subarray(s,e); var b=new Blob([], {type: type||this.type}); b._bytes = new Uint8Array(u); b.size=b._bytes.length; return b; }
        }
        globalThis.Blob = Blob;
      }

      // Request
      if (typeof Request === 'undefined') {
        class Request {
          constructor(input, init){
            init = init || {};
            if (input instanceof Request) {
              this.url = input.url; this.method = input.method; this.headers = new Headers(input.headers); this.body = input.body; this.signal = init.signal || input.signal; return;
            }
            this.url = String(input);
            this.method = (init.method || 'GET').toUpperCase();
            this.headers = new Headers(init.headers || {});
            this.body = init.body !== undefined ? init.body : null;
            this.signal = init.signal || null;
          }
        }
        globalThis.Request = Request;
      }

      if (typeof Response === 'undefined') {
        class Response {
          constructor(init = {}) {
            this.status = (init.status|0);
            this.statusText = String(init.statusText || '');
            this.ok = !!init.ok;
            this.url = init.url || '';
            this.headers = new Headers(init.headers || {});
            this._body = init.body ?? null;          // accept plain body
            this._b64  = init.bodyBase64 ?? null;    // optional base64 body
          }

    async _bytes() {
      // Prefer explicit body when provided
      const b = this._body;
      console.log('[Response._bytes] Processing body - type:', typeof b, 'constructor:', b?.constructor?.name, 'b64 available:', !!this._b64);

      // String
      if (typeof b === 'string') {
        return new TextEncoder().encode(b);
      }

      // Typed arrays / ArrayBuffer / DataView
      if (b instanceof Uint8Array) {
        console.log('[Response._bytes] Uint8Array body - length:', b.length);
        return b;
      }
      if (b instanceof ArrayBuffer) {
        console.log('[Response._bytes] ArrayBuffer body - byteLength:', b.byteLength);
        return new Uint8Array(b);
      }
      if (b instanceof DataView) {
        console.log('[Response._bytes] DataView body - byteLength:', b.byteLength, 'offset:', b.byteOffset);
        return new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
      }

      // Blob (browser/worker)
      if (typeof Blob !== 'undefined' && b instanceof Blob) {
        console.log('[Response._bytes] Blob body - size:', b.size, 'type:', b.type);
        const buffer = await b.arrayBuffer();
        console.log('[Response._bytes] Blob converted to', buffer.byteLength, 'bytes');
        return new Uint8Array(buffer);
      }

      // If someone passed a plain object, serialize like fetch users often expect
      if (b && typeof b === 'object') {
        console.log('[Response._bytes] Object body - keys:', Object.keys(b));
        const jsonString = JSON.stringify(b);
        console.log('[Response._bytes] Object serialized - length:', jsonString.length, 'preview:', jsonString.substring(0, 200));
        const encoded = new TextEncoder().encode(jsonString);
        console.log('[Response._bytes] Object encoded to', encoded.length, 'bytes');
        return encoded;
      }

      // Fallback: base64 body
      if (this._b64 != null) {
        console.log('[Response._bytes] Using base64 body - length:', this._b64.length);
        const decoded = __b64.toU8(this._b64);
        console.log('[Response._bytes] Base64 decoded to', decoded.length, 'bytes');
        return decoded;
      }

      // Nothing
      console.log('[Response._bytes] No body data found, returning empty Uint8Array');
      return new Uint8Array(0);
    }


          async text() {
            console.log('[Response.text] Body:', this._body)
            console.log('[Response.text] Body type:', typeof this._body)
            
            // For JSON/text responses, body is passed directly as string
            if (typeof this._body === 'string') {
              return this._body;
            }
            
            // Fallback to base64 decoding for binary data
            if (this._b64) {
              const decoded = __b64.toU8(this._b64);
              const text = new TextDecoder().decode(decoded);
              console.log('[Response.text] Decoded from base64:', text);
              return text;
            }
            
            return '';
          }

          async arrayBuffer() {
            try {
              console.log('[Response.arrayBuffer] Getting bytes...');
              const bytes = await this._bytes();
              console.log('[Response.arrayBuffer] Got bytes:', bytes.length, 'bytes');
              
              if (!bytes || !bytes.buffer) {
                console.error('[Response.arrayBuffer] Invalid bytes object:', typeof bytes);
                throw new Error('Invalid bytes object from _bytes()');
              }
              
              const buffer = bytes.buffer.slice(0);
              console.log('[Response.arrayBuffer] Created ArrayBuffer:', buffer.byteLength, 'bytes');
              return buffer;
            } catch (error) {
              console.error('[Response.arrayBuffer] Error:', error.message);
              throw error;
            }
          }

          async json() {
            console.log('[Response.json] Body:', this._body)
            console.log('[Response.json] Body type:', typeof this._body)
            
            // For JSON responses, body should be a string
            if (typeof this._body === 'string') {
              try {
                const parsed = JSON.parse(this._body);
                console.log('[Response.json] Successfully parsed JSON');
                return parsed;
              } catch (error) {
                console.error('[Response.json] JSON parse error:', error.message);
                throw error;
              }
            }
            
            // Fallback: try to get text first, then parse
            const text = await this.text();
            if (text) {
              try {
                const parsed = JSON.parse(text);
                console.log('[Response.json] Successfully parsed JSON from text');
                return parsed;
              } catch (error) {
                console.error('[Response.json] JSON parse error from text:', error.message);
                throw error;
              }
            }
            
            console.error('[Response.json] No valid JSON content found');
            return null;
          }

          async blob() {
            const u8 = await this._bytes();
            return new Blob([u8], { type: this.headers.get('content-type') || '' });
          }
        }
        globalThis.Response = Response;
      }

      function encodeBody(body, headers){
        if (body == null) return null;
        if (typeof body === 'string') return body;
        if (body && body.constructor && body.constructor.name === 'URLSearchParams') {
          if (!headers.has('content-type')) headers.set('content-type','application/x-www-form-urlencoded;charset=UTF-8');
          return body.toString();
        }
        if (typeof Blob !== 'undefined' && body instanceof Blob) {
          return 'base64:' + __b64.fromU8(body._bytes);
        }
        if (body && body.byteLength !== undefined && body.constructor && body.constructor.name === 'ArrayBuffer') {
          return 'base64:' + __b64.fromU8(new Uint8Array(body));
        }
        if (body && body.buffer && body.byteLength !== undefined) {
          return 'base64:' + __b64.fromU8(new Uint8Array(body.buffer, body.byteOffset||0, body.byteLength));
        }
        var ct = headers.get('content-type') || '';
        if (ct.indexOf('application/json') !== -1 && typeof body === 'object') {
          return JSON.stringify(body);
        }
        return String(body);
      }

      var _fetchSeq = 0;
      function _nextFetchId(){ _fetchSeq = (_fetchSeq + 1) | 0; return String(_fetchSeq); }

      if (typeof fetch !== 'function') {
        globalThis.fetch = function(input, init){
          var req = (input && input.constructor && input.constructor.name === 'Request') ? input : new Request(input, init||{});
          var opId = _nextFetchId();
          if (req.signal && req.signal.aborted) { try { _nativeFetchCancel(opId); } catch(_){} return Promise.reject(new Error('AbortError')); }
          var bodyStr = encodeBody(req.body, req.headers);
          var headersObj = req.headers.toObject();
          var settled = false;
          return new Promise(function(resolve, reject){
            function resolveWrap(v){ if (settled) return; settled = true; resolve(v); }
            function rejectWrap(e){ if (settled) return; settled = true; reject(e); }
            try {
              _nativeFetch2(opId, String(req.url), { method: req.method, headers: headersObj, body: bodyStr },
                function(r){ resolveWrap(new Response(r)); },
                function(e){ rejectWrap(new Error(String(e))); });
            } catch (e) {
              rejectWrap(e);
              return;
            }
            if (req.signal && typeof req.signal.addEventListener === 'function') {
              req.signal.addEventListener('abort', function(){
                if (!settled) {
                  try { _nativeFetchCancel(opId); } catch(_){}
                  rejectWrap(new Error('AbortError'));
                }
              });
            }
          });
        };
      }
    })();
    """#)
    
    // JS timers bridge: setTimeout/clearTimeout/setInterval/clearInterval
       let nativeTimerStart: @convention(block) (String, Double, Bool) -> Void = { [weak self, weak ctx] id, ms, repeats in
         guard let self = self, let ctx = ctx else { return }
         let msInt = max(0, Int(ms.rounded()))
         let q = DispatchQueue.main
         let timer = DispatchSource.makeTimerSource(queue: q)
         // schedule; we cancel after first fire for one-shot
         let interval = DispatchTimeInterval.milliseconds(max(1, msInt))
         timer.schedule(deadline: .now() + interval, repeating: repeats ? interval : interval)
         timer.setEventHandler { [weak self, weak ctx] in
           guard let self = self, let ctx = ctx else { return }
           if let fire = ctx.objectForKeyedSubscript("_timerFire") {
             _ = fire.call(withArguments: [id])
           }
           if !repeats {
             self.timersLock.lock()
             let t = self.timers.removeValue(forKey: id)
             self.timersLock.unlock()
             t?.cancel()
           }
         }
         self.timersLock.lock(); self.timers[id] = timer; self.timersLock.unlock()
         timer.resume()
       }
       ctx.setObject(nativeTimerStart, forKeyedSubscript: "_nativeTimerStart" as NSString)

       let nativeTimerClear: @convention(block) (String) -> Void = { [weak self] id in
         guard let self = self else { return }
         self.timersLock.lock()
         let t = self.timers.removeValue(forKey: id)
         self.timersLock.unlock()
         t?.cancel()
       }
       ctx.setObject(nativeTimerClear, forKeyedSubscript: "_nativeTimerClear" as NSString)

       ctx.evaluateScript(#"""
       (function(){
         if (typeof globalThis.setTimeout !== 'function') {
           var __timerSeq = 1;
           var __timerFn = Object.create(null);
           var __timerArgs = Object.create(null);
           var __timerKind = Object.create(null); // 't' one-shot, 'i' interval

           globalThis._timerFire = function(id){
             var fn = __timerFn[id];
             if (!fn) return;
             try { fn.apply(null, __timerArgs[id] || []); }
             catch (e) { try { console.error(e && e.stack || String(e)); } catch(_){} }
             if (__timerKind[id] === 't') {
               delete __timerFn[id]; delete __timerArgs[id]; delete __timerKind[id];
             }
           };

           function _startTimer(fn, ms, argsArray, repeat){
             var id = String(__timerSeq++);
             __timerFn[id] = (typeof fn === 'function') ? fn : function(){};
             __timerArgs[id] = Array.prototype.slice.call(argsArray || []);
             __timerKind[id] = repeat ? 'i' : 't';
             try { _nativeTimerStart(id, Number(ms)||0, !!repeat); } catch(_){}
             return id;
           }

           globalThis.setTimeout = function(fn, ms){
             return +_startTimer(fn, ms, Array.prototype.slice.call(arguments, 2), false);
           };
           globalThis.clearTimeout = function(id){
             id = String(id);
             try { _nativeTimerClear(id); } catch(_){}
             delete __timerFn[id]; delete __timerArgs[id]; delete __timerKind[id];
           };
           globalThis.setInterval = function(fn, ms){
             return +_startTimer(fn, ms, Array.prototype.slice.call(arguments, 2), true);
           };
           globalThis.clearInterval = function(id){
             id = String(id);
             try { _nativeTimerClear(id); } catch(_){}
             delete __timerFn[id]; delete __timerArgs[id]; delete __timerKind[id];
           };
         }
       })();
       """#)

    // ---- crypto.getRandomValues (secure) ----
    let nativeRandomBytes: @convention(block) (Int) -> String = { [weak self] len in
      let n = max(0, len)
      var bytes = [UInt8](repeating: 0, count: n)
      let rc = SecRandomCopyBytes(kSecRandomDefault, n, &bytes)
      if rc != errSecSuccess { self?.logger.error("SecRandomCopyBytes failed rc=\(rc)"); return "" }
      return Data(bytes).base64EncodedString()
    }
    ctx.setObject(nativeRandomBytes, forKeyedSubscript: "_nativeRandomBytes" as NSString)
    ctx.evaluateScript(#"""
    (function(){
      if (!window.crypto) window.crypto = {};
      if (typeof window.crypto.getRandomValues !== 'function') {
        window.crypto.getRandomValues = function(typedArray){
          var b64 = _nativeRandomBytes(typedArray.length|0);
          var bin = atob(b64);
          for (var i=0;i<typedArray.length && i<bin.length;i++) typedArray[i]=bin.charCodeAt(i)&255;
          return typedArray;
        };
      }
    })();
    """#)

    // ---- crypto.subtle.digest('SHA-256', data) via CryptoKit ----
    let nativeDigest: @convention(block) (String, String, JSValue, JSValue) -> Void = { [weak self] algo, base64In, resolve, reject in
      guard algo.uppercased() == "SHA-256" else { _ = reject.call(withArguments: ["Unsupported algorithm: \(algo)"]); self?.logger.error("nativeDigest unsupported algo=\(algo, privacy: .public)"); return }
      let b64 = base64In.hasPrefix("base64:") ? String(base64In.dropFirst(7)) : base64In
      guard let data = Data(base64Encoded: b64) else { _ = reject.call(withArguments: ["Bad data"]); self?.logger.error("nativeDigest bad base64 input"); return }
      let digest = SHA256.hash(data: data)
      let out = Data(digest).base64EncodedString()
      _ = resolve.call(withArguments: ["base64:" + out])
    }
    ctx.setObject(nativeDigest, forKeyedSubscript: "_nativeDigest" as NSString)
    ctx.evaluateScript(#"""
    (function(){
      function ab2b64(buf){
        var u8 = (buf instanceof ArrayBuffer) ? new Uint8Array(buf)
                : (ArrayBuffer.isView(buf) ? new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
                                           : new TextEncoder().encode(String(buf)));
        return __b64.fromU8(u8);
      }
      if (!crypto.subtle) crypto.subtle = {};
      if (typeof crypto.subtle.digest !== 'function') {
        crypto.subtle.digest = function(name, data){
          var b64 = 'base64:' + ab2b64(data);
          return new Promise(function(resolve, reject){
            _nativeDigest(String(name), b64, resolve, reject);
          }).then(function(outB64){
            var u8 = __b64.toU8(outB64.slice(7));
            return u8.buffer;
          });
        };
      }
    })();
    """#)

    // --- Pull snap: prefer App Group defaults, fallback to APNS payload ---
    var snapJSON: String = ""
    if let defaults = UserDefaults(suiteName: APP_GROUP_ID), let s = defaults.string(forKey: SNAP_KEY), !s.isEmpty {
      snapJSON = s
      logger.debug("Loaded snap from app group (len=\(s.count)) id=\(reqID, privacy: .public)")
    } else if let s = request.content.userInfo["snap"] as? String {
      snapJSON = s
      logger.debug("Loaded snap from APNS payload (len=\(s.count)) id=\(reqID, privacy: .public)")
    } else {
      logger.notice("No snap found in app group or APNS payload. id=\(reqID, privacy: .public)")
    }

    // ---- Load bundled JS (wallet-bundle.js) ----
    guard let jsURL = Bundle.main.url(forResource: "wallet-bundle", withExtension: "js"),
          let script = try? String(contentsOf: jsURL) else {
      logger.error("Failed to load wallet-bundle.js id=\(reqID, privacy: .public)")
      complete(.loadJSBundleFailed)
      return
    }
    ctx.evaluateScript(script)
    if let exc = ctx.exception {
      logger.error("Exception after evaluating bundle: \(String(describing: exc), privacy: .public)")
      complete(.jsException)
      return
    }

    // ---- Invoke window.run(snap, messageId) ----
    let userInfo = request.content.userInfo
    let messageId: String =
      (userInfo["messageId"] as? String) ??
      ((userInfo["data"] as? [String: Any])?["messageId"] as? String) ??
      (userInfo["gcm.message_id"] as? String) ??
      (userInfo["fcmMessageId"] as? String) ??
      UUID().uuidString

    logger.debug("Invoking run(snap, messageId=\(messageId, privacy: .public)) id=\(reqID, privacy: .public)")

    guard let run = ctx.objectForKeyedSubscript("run"), !run.isUndefined else {
      logger.error("window.run is missing/undefined id=\(reqID, privacy: .public)")
      complete(.jsMissingRun)
      return
    }

    guard let promise = run.call(withArguments: [snapJSON, messageId]) else {
      logger.error("run(...) did not return a value id=\(reqID, privacy: .public)")
      complete(.jsNoPromise)
      return
    }

    guard promise.hasProperty("then") else {
      logger.error("run(...) did not return a thenable id=\(reqID, privacy: .public)")
      complete(.jsNoPromise)
      return
    }

    let fulfill: @convention(block) (JSValue?) -> Void = { [weak self] result in
      guard let self = self else { return }
      self.logger.info("JS fulfilled id=\(reqID, privacy: .public) elapsedMs=\(msElapsed())")
      if let dict = result?.toDictionary() as? [String: Any] {
        if let t = dict["title"] as? String { best.title = t }
        if let b = dict["body"]  as? String { best.body  = b }
        if let data = dict["data"] as? [String: Any] {
          best.userInfo = best.userInfo.merging(["data": data]) { $1 }
        }
      }
      self.bestAttemptContent = best
      complete(.success)
    }

    let reject: @convention(block) (JSValue?) -> Void = { [weak self] error in
      guard let self = self else { return }
      self.logger.error("JS rejected id=\(reqID, privacy: .public): \(String(describing: error), privacy: .public)")
      complete(.jsRejected)
    }

    let thenArg  = JSValue(object: fulfill, in: ctx)!
    let catchArg = JSValue(object: reject,  in: ctx)!
    
    // Chain .then() and .catch() for robust error handling
    let thenPromise = promise.invokeMethod("then", withArguments: [thenArg])
    _ = thenPromise?.invokeMethod("catch", withArguments: [catchArg])

    // ---- Safety timeout (10s) ----
    DispatchQueue.global().asyncAfter(deadline: .now() + 10) { [weak self] in
      guard let self = self else { return }
      if !completed {
        self.logger.error("Safety timeout fired id=\(reqID, privacy: .public) elapsedMs=\(msElapsed())")
        complete(.timeout)
      }
    }
  }

  override func serviceExtensionTimeWillExpire() {
    // Cancel any in-flight fetches to free resources quickly
    tasksLock.lock(); let opIds = Array(tasks.keys); let inFlight = tasks.values; tasks.removeAll(); tasksLock.unlock()
    for t in inFlight { t.cancel() }
    if !opIds.isEmpty { logger.debug("serviceExtensionTimeWillExpire: cancelled \(opIds.count) fetch task(s)") }
    
    // Cancel active timers
    timersLock.lock(); let activeTimers = timers.values; timers.removeAll(); timersLock.unlock()
    for t in activeTimers { t.cancel() }

    let hasBest = bestAttemptContent != nil
    logger.error("serviceExtensionTimeWillExpire fired; returning bestAttemptContent? \(hasBest, privacy: .public)")
    if let contentHandler = contentHandler, let best = bestAttemptContent {
      contentHandler(best)
    }
  }
}
