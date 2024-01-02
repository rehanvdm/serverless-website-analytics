// import { DateUtils } from '@backend/lib/utils/date_utils';
// import { AthenaBase } from '@backend/lib/utils/athena_base';
// import { getDdbClient } from '@backend/lib/utils/lazy_aws';
// import {createSchema, Entity, EntityItem, QueryResponse, Schema, CreateEntityItem} from "electrodb";
// import {DynamoDBClient} from "@aws-sdk/client-dynamodb";
//
// const pageHistorySchema = createSchema({
//     model: {
//       service: "history",
//       entity: "page",
//       version: "1",
//     },
//     attributes: {
//       month: {
//         type: "string",
//         required: true,
//       },
//       day: {
//         type: "string",
//         required: true,
//       },
//       hours: {
//         type: "string",
//         required: true,
//       },
//     },
//     indexes: {
//       byMonth: {
//         pk: {
//           field: "PK",
//           composite: ["month"],
//         },
//         sk: {
//           field: "SK",
//           composite: ["day"],
//         },
//       },
//     },
//   }
// );
// export type PageHistory = Entity<any, any, any, typeof pageHistorySchema>;
// export type PageHistoryItem = EntityItem<PageHistory>;
// export type PageHistoryCreateEntityItem = CreateEntityItem<PageHistory>;
// // export type PageHistoryQueryResponse = QueryResponse<PageHistory>;
//
//
//
// export class DynamoDbAnalytics {
//   private readonly tableName: string;
//   private readonly ddbClient: DynamoDBClient;
//
//   private pageHistory: PageHistory;
//
//   constructor(tableName: string) {
//     this.tableName = tableName;
//     this.ddbClient = getDdbClient();
//   }
//
//   public getPageHistory() {
//     if(!this.pageHistory) {
//       this.pageHistory = new Entity(pageHistorySchema, {
//         table: this.tableName,
//         client: this.ddbClient,
//       });
//     }
//
//     return this.pageHistory;
//   }
// }
//
//
// //extends Entity<string, string, string, typeof schema>
// //super(schema, {
// //         table: tableName,
// //         client: ddbClient,
// //       });
//
// // const schema = {
// //   model: {
// //     entity: "pagehistory",
// //     version: "1",
// //     service: "analytics",
// //   },
// //   attributes: {
// //     hours: {
// //       type: "string",
// //       required: true,
// //     },
// //   },
// //   indexes: {
// //     historyPage: {
// //       pk: {
// //         field: "PK",
// //         composite: ["month"],
// //       },
// //       sk: {
// //         field: "SK",
// //         composite: ["day"],
// //       },
// //     },
// //     historyEvent: {
// //       pk: {
// //         field: "PK",
// //         composite: ["month"],
// //       },
// //       sk: {
// //         field: "SK",
// //         composite: ["day"],
// //       },
// //     },
// //   },
// // } as const;
// //
// // export class DynamoDbAnalytics extends Entity<string, string, string, typeof schema>{
// //
// //   constructor(tableName: string) {
// //     const ddbClient = getDdbClient();
// //     super(schema, {
// //             table: tableName,
// //             client: ddbClient,
// //           });
// //   }
// // }
