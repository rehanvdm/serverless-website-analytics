import { DeleteObjectCommand, ListObjectsV2Command, ListObjectsV2CommandOutput, S3Client } from '@aws-sdk/client-s3';
import pLimit from 'p-limit';

export class S3Base {
  protected readonly s3Client: S3Client;
  protected readonly bucketName: string;
  constructor(s3Client: S3Client, bucketName: string) {
    this.s3Client = s3Client;
    this.bucketName = bucketName;
  }

  protected async getAllObjects(prefix = '') {
    let allObjects: { key: string }[] = [];
    let continuationToken;
    do {
      const response: ListObjectsV2CommandOutput = await this.s3Client.send(
        new ListObjectsV2Command({
          Bucket: this.bucketName,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        })
      );
      const objects = response.Contents || [];

      allObjects = allObjects.concat(
        objects.map((object) => {
          return {
            key: object.Key || '',
          };
        })
      );
      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    return allObjects;
  }

  public async deleteAllObjects(keys: string[], concurrency = 100) {
    const limit = pLimit(concurrency);
    const promises = [];

    for (const key of keys) {
      promises.push(
        limit(() => {
          return this.s3Client.send(
            new DeleteObjectCommand({
              Bucket: this.bucketName,
              Key: key,
            })
          );
        })
      );
    }
    await Promise.all(promises);
  }
}
