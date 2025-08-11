//
//  NotificationService.swift
//  MetanetNotificationService
//
//  Created by Brayden Langley on 8/8/25.
//
import UserNotifications
import JavaScriptCore
import os.log
import CryptoKit

private let APP_GROUP_ID = "group.org.bsvblockchain.metanet"
private let SNAP_KEY = "snap"

class NotificationService: UNNotificationServiceExtension {
  var contentHandler: ((UNNotificationContent) -> Void)?
  var bestAttemptContent: UNMutableNotificationContent?

  override func didReceive(_ request: UNNotificationRequest,
                           withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void) {
    self.contentHandler = contentHandler
    guard let best = (request.content.mutableCopy() as? UNMutableNotificationContent) else {
      contentHandler(request.content); return
    }

    // Ephemeral session for the NSE
    let cfg = URLSessionConfiguration.ephemeral
    cfg.timeoutIntervalForRequest = 20
    cfg.timeoutIntervalForResource = 25
    cfg.waitsForConnectivity = false
    let session = URLSession(configuration: cfg)

    // One JS VM + context
    let vm = JSVirtualMachine()
    let ctx = JSContext(virtualMachine: vm)!
//    self.ctx = ctx

    // Log JS exceptions
    ctx.exceptionHandler = { _, exc in
      NSLog("NSE JS exception: %@", String(describing: exc))
    }

    // ---- Globals & console ----
    if let g = ctx.globalObject {
      g.setValue(g, forProperty: "globalThis")
      g.setValue(g, forProperty: "self")
      g.setValue(g, forProperty: "window")
    }
    let console = JSValue(newObjectIn: ctx)
    let logBlock: @convention(block) (JSValue?) -> Void = { v in
      NSLog("[JS] %@", String(describing: v))
    }
    console?.setObject(logBlock, forKeyedSubscript: "log" as NSString)
    ctx.globalObject.setObject(console, forKeyedSubscript: "console" as NSString)

    // ---- Polyfills: atob/btoa, TextEncoder/Decoder ----
    ctx.evaluateScript(#"""
    (function(){
      if (typeof TextEncoder === 'undefined') {
        class TextEncoder { encode(s){ var a=[]; for (var i=0;i<s.length;i++) a.push(s.charCodeAt(i)&255); return new Uint8Array(a); } }
        class TextDecoder { decode(u8){ var s=''; for (var i=0;i<u8.length;i++) s+=String.fromCharCode(u8[i]); return s; } }
        window.TextEncoder = TextEncoder; window.TextDecoder = TextDecoder;
      }
      (function(){
        function b64ToUint6(n){return n>64&&n<91?n-65:n>96&&n<123?n-71:n>47&&n<58?n+4:n===43?62:n===47?63:0}
        if (typeof atob !== 'function') {
          window.atob = function(a){var s=String(a).replace(/=+$/,'');var len=s.length;var bytes=new Uint8Array((len*3/4|0));var bc=0,bi=0,bs=0;for(var i=0;i<len;i++){bs=(bs<<6)|b64ToUint6(s.charCodeAt(i));if(i%4===3){bytes[bc++]=(bs>>>16)&255;bytes[bc++]=(bs>>>8)&255;bytes[bc++]=bs&255;}}if(len%4===2)bytes=bytes.slice(0,bc-2);else if(len%4===3)bytes=bytes.slice(0,bc-1);return new TextDecoder().decode(bytes);};
        }
        if (typeof btoa !== 'function') {
          window.btoa = function(b){var bytes=new TextEncoder().encode(String(b)), base64='', chars='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';var i=0;for(;i+2<bytes.length;i+=3){var x=(bytes[i]<<16)|(bytes[i+1]<<8)|bytes[i+2];base64+=chars[(x>>>18)&63]+chars[(x>>>12)&63]+chars[(x>>>6)&63]+chars[x&63]}if(i<bytes.length){var x=bytes[i]<<16;var pad='==';if(i+1<bytes.length){x|=bytes[i+1]<<8;pad='='}base64+=chars[(x>>>18)&63]+chars[(x>>>12)&63]+(pad==='='?'=':chars[(x>>>6)&63])+pad}return base64;};
        }
      })();
    })();
    """#)

    // ---- fetch bridge (URLSession) ----
    let nativeFetch: @convention(block) (String, JSValue?, JSValue, JSValue) -> Void = { urlStr, initVal, resolve, reject in
      guard let url = URL(string: urlStr) else { _ = reject.call(withArguments: ["Invalid URL"]); return }
      var req = URLRequest(url: url)
      req.httpMethod = (initVal?.forProperty("method").toString() ?? "GET")
      req.timeoutInterval = 20

      if let headersObj = initVal?.forProperty("headers"),
         let dict = headersObj.toDictionary() as? [String: Any] {
        for (k,v) in dict { req.setValue(String(describing: v), forHTTPHeaderField: k) }
      }
      if let bodyVal = initVal?.forProperty("body"), !bodyVal.isUndefined {
        if bodyVal.isString, let s = bodyVal.toString() {
          if s.hasPrefix("base64:") {
            let b64 = String(s.dropFirst(7))
            req.httpBody = Data(base64Encoded: b64)
          } else {
            req.httpBody = s.data(using: .utf8)
          }
        }
      }

      session.dataTask(with: req) { data, resp, err in
        if let err = err { _ = reject.call(withArguments: [String(describing: err)]); return }
        guard let http = resp as? HTTPURLResponse else { _ = reject.call(withArguments: ["No response"]); return }
        let headers = http.allHeaderFields.reduce(into: [String:String]()) { acc, kv in
          acc[String(describing: kv.key)] = String(describing: kv.value)
        }
        let result: [String: Any] = [
          "status": http.statusCode,
          "ok": (200...299).contains(http.statusCode),
          "url": http.url?.absoluteString ?? urlStr,
          "headers": headers,
          "bodyBase64": (data?.base64EncodedString() ?? "")
        ]
        _ = resolve.call(withArguments: [result])
      }.resume()
    }
    ctx.setObject(nativeFetch, forKeyedSubscript: "_nativeFetch" as NSString)

    ctx.evaluateScript(#"""
    (function(){
      function Response(init){
        this.status = init.status|0;
        this.ok = !!init.ok;
        this.url = init.url||'';
        this.headers = new Map(Object.entries(init.headers||{}));
        this._b64 = init.bodyBase64||'';
      }
      Response.prototype.text = function(){ return Promise.resolve(atob(this._b64)); };
      Response.prototype.arrayBuffer = function(){
        var bin = atob(this._b64), len = bin.length, u8 = new Uint8Array(len);
        for (var i=0;i<len;i++) u8[i]=bin.charCodeAt(i)&255;
        return Promise.resolve(u8.buffer);
      };
      Response.prototype.json = function(){ return this.text().then(JSON.parse); };
      if (typeof fetch !== 'function') {
        window.fetch = function(input, init){
          return new Promise(function(resolve, reject){
            _nativeFetch(String(input), init||{}, function(r){ resolve(new Response(r)); },
                         function(e){ reject(new Error(String(e))); });
          });
        };
      }
    })();
    """#)

    // ---- crypto.getRandomValues (secure) ----
    let nativeRandomBytes: @convention(block) (Int) -> String = { len in
      let n = max(0, len)
      var bytes = [UInt8](repeating: 0, count: n)
      let rc = SecRandomCopyBytes(kSecRandomDefault, n, &bytes)
      if rc != errSecSuccess { return "" }
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
    let nativeDigest: @convention(block) (String, String, JSValue, JSValue) -> Void = { algo, base64In, resolve, reject in
      guard algo.uppercased() == "SHA-256" else { _ = reject.call(withArguments: ["Unsupported algorithm: \(algo)"]); return }
      let b64 = base64In.hasPrefix("base64:") ? String(base64In.dropFirst(7)) : base64In
      guard let data = Data(base64Encoded: b64) else { _ = reject.call(withArguments: ["Bad data"]); return }
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
        var bin = ''; for (var i=0;i<u8.length;i++) bin += String.fromCharCode(u8[i]);
        return btoa(bin);
      }
      if (!crypto.subtle) crypto.subtle = {};
      if (typeof crypto.subtle.digest !== 'function') {
        crypto.subtle.digest = function(name, data){
          var b64 = 'base64:' + ab2b64(data);
          return new Promise(function(resolve, reject){
            _nativeDigest(String(name), b64, resolve, reject);
          }).then(function(outB64){
            var bin = atob(outB64.slice(7)), u8 = new Uint8Array(bin.length);
            for (var i=0;i<bin.length;i++) u8[i]=bin.charCodeAt(i)&255;
            return u8.buffer;
          });
        };
      }
    })();
    """#)
    
    // --- Pull snap: prefer App Group defaults, fallback to APNS payload ---
    var snapJSON: String = ""
    if let defaults = UserDefaults(suiteName: APP_GROUP_ID),
       let s = defaults.string(forKey: SNAP_KEY),
       !s.isEmpty {
      snapJSON = s
    } else if let s = request.content.userInfo["snap"] as? String {
      snapJSON = s
    }

    // ---- Load bundled JS (wallet-bundle.js) ----
    guard let jsURL = Bundle.main.url(forResource: "wallet-bundle", withExtension: "js"),
          let script = try? String(contentsOf: jsURL) else {
      contentHandler(best); return
    }
    ctx.evaluateScript(script)

    // ---- Invoke window.run(snap, messageId) ----
    let messageId = (request.content.userInfo["messageId"] as? String) ?? "id"

    guard let run = ctx.objectForKeyedSubscript("run"), !run.isUndefined,
          let promise = run.call(withArguments: [snapJSON, messageId]), promise.hasProperty("then") else {
      // No callable run or not a promise
      contentHandler(best); return
    }

    var completed = false
    let fulfill: @convention(block) (JSValue?) -> Void = { result in
      guard !completed else { return }
      completed = true
      if let dict = result?.toDictionary() as? [String: Any] {
        if let t = dict["title"] as? String { best.title = t }
        if let b = dict["body"]  as? String { best.body  = b }
        if let data = dict["data"] as? [String: Any] {
          best.userInfo = best.userInfo.merging(["data": data]) { $1 }
        }
      }
      contentHandler(best)
    }
    let reject: @convention(block) (JSValue?) -> Void = { error in
      guard !completed else { return }
      completed = true
      NSLog("JS rejected: %@", String(describing: error))
      contentHandler(best)
    }

    let thenArg  = JSValue(object: fulfill, in: ctx)!
    let catchArg = JSValue(object: reject,  in: ctx)!
    _ = promise.invokeMethod("then", withArguments: [thenArg, catchArg])

    // ---- Safety timeout (10s) ----
    DispatchQueue.global().asyncAfter(deadline: .now() + 10) {
      if !completed {
        completed = true
        contentHandler(best)
      }
    }
  }


  override func serviceExtensionTimeWillExpire() {
    if let contentHandler = contentHandler, let best = bestAttemptContent {
      contentHandler(best)
    }
  }
}
