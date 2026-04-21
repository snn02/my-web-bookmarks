import { createApp } from './app';

const port = Number(process.env.PORT ?? 4321);

createApp().listen(port, '127.0.0.1', () => {
  console.log(`desktop-api listening on http://127.0.0.1:${port}`);
});
