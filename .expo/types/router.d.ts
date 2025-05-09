/* eslint-disable */
import * as Router from 'expo-router';

export * from 'expo-router';

declare module 'expo-router' {
  export namespace ExpoRouter {
    export interface __routes<T extends string | object = string> {
      hrefInputParams: { pathname: Router.RelativePathString, params?: Router.UnknownInputParams } | { pathname: Router.ExternalPathString, params?: Router.UnknownInputParams } | { pathname: `/_sitemap`; params?: Router.UnknownInputParams; } | { pathname: `/components/Browser`; params?: Router.UnknownInputParams; } | { pathname: `/components/KeyProvider`; params?: Router.UnknownInputParams; } | { pathname: `/components/Scanner`; params?: Router.UnknownInputParams; };
      hrefOutputParams: { pathname: Router.RelativePathString, params?: Router.UnknownOutputParams } | { pathname: Router.ExternalPathString, params?: Router.UnknownOutputParams } | { pathname: `/_sitemap`; params?: Router.UnknownOutputParams; } | { pathname: `/components/Browser`; params?: Router.UnknownOutputParams; } | { pathname: `/components/KeyProvider`; params?: Router.UnknownOutputParams; } | { pathname: `/components/Scanner`; params?: Router.UnknownOutputParams; };
      href: Router.RelativePathString | Router.ExternalPathString | `/_sitemap${`?${string}` | `#${string}` | ''}` | `/components/Browser${`?${string}` | `#${string}` | ''}` | `/components/KeyProvider${`?${string}` | `#${string}` | ''}` | `/components/Scanner${`?${string}` | `#${string}` | ''}` | { pathname: Router.RelativePathString, params?: Router.UnknownInputParams } | { pathname: Router.ExternalPathString, params?: Router.UnknownInputParams } | { pathname: `/_sitemap`; params?: Router.UnknownInputParams; } | { pathname: `/components/Browser`; params?: Router.UnknownInputParams; } | { pathname: `/components/KeyProvider`; params?: Router.UnknownInputParams; } | { pathname: `/components/Scanner`; params?: Router.UnknownInputParams; };
    }
  }
}
