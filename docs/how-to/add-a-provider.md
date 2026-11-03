# Add a custom provider

1. Start the app with `npm run dev`.
2. Open settings and select the custom provider controls.
3. Enter an ID, a name, and an HTTP base URL.
4. Set the models path and chat path to match the gateway.
5. Choose the stream format and save the provider.
6. Select its backend and model from the chat picker.

The provider definition is written to `.standard-ui/provider-plugins.json`. Supported formats and defaults are in [configuration](../reference/configuration.md).

The server reads model lists from the configured models path when the source is `remote`. A `static` source uses the supplied model list.
