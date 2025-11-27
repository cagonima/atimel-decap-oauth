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

    const responseBody = renderBody("success", token);

    res.statusCode = 200;
    res.end(responseBody);
  } catch (e) {
    res.statusCode = 200;
    res.end(renderBody("error", null));
  }
};

function renderBody(status: string, token: string | null) {
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
            const receiveMessage = (message) => {
              // Wait for handshake reply from Decap before sending token
              if (message.data === 'decap-oauth-handshake') {
                window.removeEventListener("message", receiveMessage, false);
                
                // Send the final token back to Decap CMS and close this popup
                var msg = 'authorization:github:${status}:${JSON.stringify({ token })}';
                window.opener.postMessage(msg, '*');
                window.close();
              }
            };
            
            window.addEventListener("message", receiveMessage, false);
            
            // Notify Decap that authorization is starting
            window.opener.postMessage("authorizing:github", "*");
          })();
        </script>
        <p>Authorizing Decap...</p>
      </body>
    </html>
  `;
}
