import { IncomingMessage, ServerResponse } from "http";
import { AuthorizationCode } from "simple-oauth2";
import { config, Provider } from "../lib/config";

export default async (req: IncomingMessage, res: ServerResponse) => {
  const { host } = req.headers;
  const url = new URL(`https://${host}/${req.url}`);
  const urlParams = url.searchParams;
  const code = urlParams.get("code");
  const provider = urlParams.get("provider") as Provider;

  try {
    if (!code) throw new Error(`Missing code ${code}`);

    const client = new AuthorizationCode(config(provider));
    const tokenParams = {
      code,
      redirect_uri: `https://${host}/callback?provider=${provider}`,
    };

    const accessToken = await client.getToken(tokenParams);
    const token = accessToken.token["access_token"] as string;

    const responseBody = renderBody("success", {
      token,
      // REMOVE: provider field from JSON - Decap doesn't expect it
    });

    res.statusCode = 200;
    res.end(responseBody);
  } catch (e) {
    res.statusCode = 200;
    res.end(renderBody("error", e));
  }
};

function renderBody(status: string, content: any) {
  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Decap OAuth</title>
      </head>
      <body>
        <script>
          (function() {
            // FIXED: Only include token in JSON, not provider
            var msg = 'authorization:github:${status}:${JSON.stringify(content)}';
            if (window.opener && typeof window.opener.postMessage === 'function') {
              // Send the final token back to Decap CMS and close this popup
              window.opener.postMessage(msg, '*');
              window.close();
            } else {
              document.body.innerText = 'Authentication finished. You can close this window.';
            }
          })();
        </script>
      </body>
    </html>
  `;
}
