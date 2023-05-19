import {initTRPC} from '@trpc/server';
import { OpenApiMeta } from 'trpc-openapi';
import { z } from 'zod';

import {pageView} from "@backend/api-ingest/v1/page/view"
import {eventTrack} from "@backend/api-ingest/v1/event/track"

export type Context = {
  request: {
    ip: string,
    ua: string
  }
};

const trpcInstance = initTRPC
  .context<Context>()
  .meta<OpenApiMeta>()
  .create({isDev: true});

export type TrpcInstance = typeof trpcInstance;

export const appRouter =  trpcInstance.router( {
  pageView: pageView(trpcInstance),
  eventTrack: eventTrack(trpcInstance),
});

export type AppRouter = typeof appRouter;
