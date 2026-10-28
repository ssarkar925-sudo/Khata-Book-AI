package com.khatabook.ai;

import android.content.Context;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.NetworkRequest;
import android.os.Bundle;
import android.webkit.WebView;
import androidx.annotation.NonNull;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;

public class MainActivity extends BridgeActivity {
    private boolean isOfflineOrError = false;
    private ConnectivityManager connectivityManager;
    private ConnectivityManager.NetworkCallback networkCallback;
    private static final String APP_URL = "https://aikhata.vercel.app";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setupWebViewListener();
        setupNetworkMonitoring();
    }

    private void setupWebViewListener() {
        if (getBridge() != null) {
            getBridge().addWebViewListener(new WebViewListener() {
                @Override
                public void onReceivedError(WebView webView) {
                    showOfflinePage(webView);
                }

                @Override
                public void onPageLoaded(WebView webView) {
                    if (webView != null) {
                        String currentUrl = webView.getUrl();
                        if (currentUrl != null && currentUrl.startsWith(APP_URL)) {
                            isOfflineOrError = false;
                        }
                    }
                }
            });
        }
    }

    private void showOfflinePage(WebView webView) {
        isOfflineOrError = true;
        runOnUiThread(() -> {
            if (webView != null) {
                webView.loadDataWithBaseURL(APP_URL, getOfflineHtml(), "text/html", "UTF-8", null);
            }
        });
    }

    private void setupNetworkMonitoring() {
        try {
            connectivityManager = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
            if (connectivityManager != null) {
                NetworkRequest request = new NetworkRequest.Builder()
                    .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                    .build();

                networkCallback = new ConnectivityManager.NetworkCallback() {
                    @Override
                    public void onAvailable(@NonNull Network network) {
                        runOnUiThread(() -> {
                            WebView webView = (getBridge() != null) ? getBridge().getWebView() : null;
                            if (webView != null) {
                                if (isOfflineOrError) {
                                    isOfflineOrError = false;
                                    webView.loadUrl(APP_URL);
                                } else {
                                    webView.evaluateJavascript(
                                        "if (typeof window !== 'undefined' && window.dispatchEvent) { window.dispatchEvent(new Event('online')); }",
                                        null
                                    );
                                }
                            }
                        });
                    }

                    @Override
                    public void onLost(@NonNull Network network) {
                        runOnUiThread(() -> {
                            WebView webView = (getBridge() != null) ? getBridge().getWebView() : null;
                            if (webView != null && !isOfflineOrError) {
                                webView.evaluateJavascript(
                                    "if (typeof window !== 'undefined' && window.dispatchEvent) { window.dispatchEvent(new Event('offline')); }",
                                    null
                                );
                            }
                        });
                    }
                };

                connectivityManager.registerNetworkCallback(request, networkCallback);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @Override
    public void onBackPressed() {
        WebView webView = (getBridge() != null) ? getBridge().getWebView() : null;
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (connectivityManager != null && networkCallback != null) {
            try {
                connectivityManager.unregisterNetworkCallback(networkCallback);
            } catch (Exception ignored) {}
        }
    }

    private String getOfflineHtml() {
        return "<!DOCTYPE html>"
            + "<html lang=\"en\">"
            + "<head>"
            + "<meta charset=\"UTF-8\">"
            + "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no\">"
            + "<title>Offline - Record Book</title>"
            + "<style>"
            + "  * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }"
            + "  body { background: #070a12; color: #f8fafc; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; padding: 24px; text-align: center; overflow: hidden; }"
            + "  .card { background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 24px; padding: 36px 24px; max-width: 360px; width: 100%; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); }"
            + "  .logo { width: 48px; height: 48px; border-radius: 14px; background: linear-gradient(135deg, #6366f1, #a855f7, #14b8a6); display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 16px; color: white; margin: 0 auto 20px auto; box-shadow: 0 10px 20px -5px rgba(99, 102, 241, 0.4); }"
            + "  .icon-box { width: 64px; height: 64px; background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px auto; }"
            + "  .icon-box svg { width: 32px; height: 32px; stroke: #f87171; }"
            + "  h1 { font-size: 19px; font-weight: 700; margin-bottom: 8px; color: #ffffff; letter-spacing: -0.02em; }"
            + "  p { font-size: 13.5px; color: #94a3b8; line-height: 1.5; margin-bottom: 24px; }"
            + "  .status-badge { display: inline-flex; align-items: center; gap: 8px; background: rgba(99, 102, 241, 0.15); border: 1px solid rgba(99, 102, 241, 0.3); border-radius: 9999px; padding: 6px 14px; font-size: 12.5px; font-weight: 500; color: #a5b4fc; margin-bottom: 24px; }"
            + "  .dot { width: 7px; height: 7px; background: #6366f1; border-radius: 50%; animation: pulse 1.4s infinite; }"
            + "  @keyframes pulse { 0% { transform: scale(0.9); opacity: 0.4; } 50% { transform: scale(1.3); opacity: 1; } 100% { transform: scale(0.9); opacity: 0.4; } }"
            + "  .retry-btn { width: 100%; background: linear-gradient(135deg, #4f46e5, #6366f1); color: #ffffff; font-weight: 600; font-size: 14.5px; padding: 13px 20px; border: none; border-radius: 12px; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3); }"
            + "  .retry-btn:active { transform: scale(0.98); opacity: 0.9; }"
            + "</style>"
            + "</head>"
            + "<body>"
            + "<div class=\"card\">"
            + "  <div class=\"logo\">RB</div>"
            + "  <div class=\"icon-box\">"
            + "    <svg fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" viewBox=\"0 0 24 24\"><path stroke-linecap=\"round\" stroke-linejoin=\"round\" d=\"M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824-2.179a5 5 0 014.243 1.414M3 3l18 18\"/></svg>"
            + "  </div>"
            + "  <h1>No Internet Connection</h1>"
            + "  <p>Record Book will automatically reconnect as soon as your Wi-Fi or mobile data is back.</p>"
            + "  <div class=\"status-badge\"><div class=\"dot\"></div> Auto-reconnecting...</div>"
            + "  <button class=\"retry-btn\" onclick=\"tryReload()\">Retry Now</button>"
            + "</div>"
            + "<script>"
            + "  function tryReload() {"
            + "    window.location.href = '" + APP_URL + "';"
            + "  }"
            + "  window.addEventListener('online', function() {"
            + "    tryReload();"
            + "  });"
            + "  setInterval(function() {"
            + "    if (navigator.onLine) {"
            + "      fetch('" + APP_URL + "/manifest.json', { method: 'HEAD', mode: 'no-cors', cache: 'no-store' })"
            + "        .then(function() { tryReload(); })"
            + "        .catch(function() {});"
            + "    }"
            + "  }, 2000);"
            + "</script>"
            + "</body>"
            + "</html>";
    }
}
