import { API_BASE_PATH, healthResponse } from '@my-web-bookmarks/shared';
import express, { type Express } from 'express';

export function createApp(): Express {
  const app = express();

  app.use(express.json());

  app.get(`${API_BASE_PATH}/health`, (_request, response) => {
    response.status(200).json(healthResponse());
  });

  return app;
}
