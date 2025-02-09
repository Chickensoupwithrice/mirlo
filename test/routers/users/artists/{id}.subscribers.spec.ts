import assert from "node:assert";

import * as dotenv from "dotenv";
dotenv.config();
import { describe, it } from "mocha";
import {
  clearTables,
  createArtist,
  createTier,
  createUser,
} from "../../../utils";
import prisma from "../../../../prisma/prisma";
import {
  minioClient,
  createBucketIfNotExists,
  finalArtistAvatarBucket,
} from "../../../../src/utils/minio";

import { requestApp } from "../../utils";

describe("users/{userId}/artists/{artistId}/subscribers", () => {
  beforeEach(async () => {
    try {
      await clearTables();
    } catch (e) {
      console.error(e);
    }
  });

  describe("GET", () => {
    it("should get json", async () => {
      const { user, accessToken } = await createUser({ email: "test@testcom" });
      const artist = await createArtist(user.id);

      const response = await requestApp
        .get(`users/${user.id}/artists/${artist.id}/subscribers`)
        .set("Cookie", [`jwt=${accessToken}`])
        .set("Accept", "application/json");
      assert.equal(response.statusCode, 200);
      assert.deepEqual(response.body.results, []);
    });

    it("should get csv", async () => {
      const { user, accessToken } = await createUser({ email: "test@testcom" });
      const artist = await createArtist(user.id);

      await prisma.artistAvatar.create({
        data: {
          artistId: artist.id,
        },
      });

      const response = await requestApp
        .get(`users/${user.id}/artists/${artist.id}/subscribers?format=csv`)
        .set("Cookie", [`jwt=${accessToken}`])
        .set("Accept", "application/json");
      assert.equal(response.statusCode, 200);
      assert.equal(response.header["content-type"], "text/csv; charset=utf-8");
      assert.equal(response.text.split(",")[0], '"Email"');
    });
  });

  describe("POST", () => {
    it("should upload new subscriptions", async () => {
      const { user, accessToken } = await createUser({ email: "test@testcom" });
      const artist = await createArtist(user.id);
      const tier = await createTier(artist.id, { isDefaultTier: true });
      const subscriberEmail = "subscriber1@email.com";

      const response = await requestApp
        .post(`users/${user.id}/artists/${artist.id}/subscribers`)
        .send({
          subscribers: [
            {
              email: subscriberEmail,
            },
          ],
        })
        .set("Cookie", [`jwt=${accessToken}`])
        .set("Accept", "application/json");

      assert.equal(response.statusCode, 200);

      const created = await prisma.user.findFirst({
        where: {
          email: subscriberEmail,
        },
      });

      assert.notEqual(created, null);
      assert(created);

      const subscription = await prisma.artistUserSubscription.findFirst({
        where: {
          userId: created.id,
          artistSubscriptionTierId: tier.id,
        },
      });

      assert.notEqual(subscription, null);
    });

    it("should handle an existing user", async () => {
      const subscriberEmail = "subscriber1@email.com";

      const { user, accessToken } = await createUser({ email: "test@testcom" });
      const { user: subscriber } = await createUser({ email: subscriberEmail });
      const artist = await createArtist(user.id);
      const tier = await createTier(artist.id, { isDefaultTier: true });

      const response = await requestApp
        .post(`users/${user.id}/artists/${artist.id}/subscribers`)
        .send({
          subscribers: [
            {
              email: subscriberEmail,
            },
          ],
        })
        .set("Cookie", [`jwt=${accessToken}`])
        .set("Accept", "application/json");

      assert.equal(response.statusCode, 200);

      const created = await prisma.user.findFirst({
        where: {
          email: subscriberEmail,
        },
      });

      assert.notEqual(created, null);

      const subscription = await prisma.artistUserSubscription.findFirst({
        where: {
          userId: subscriber.id,
          artistSubscriptionTierId: tier.id,
        },
      });

      assert.notEqual(subscription, null);
    });

    it("should handle an existing subscription", async () => {
      const subscriberEmail = "subscriber1@email.com";

      const { user, accessToken } = await createUser({ email: "test@testcom" });
      const { user: subscriber } = await createUser({ email: subscriberEmail });
      const artist = await createArtist(user.id);
      const tier = await createTier(artist.id, { isDefaultTier: true });

      await prisma.artistUserSubscription.create({
        data: {
          userId: subscriber.id,
          artistSubscriptionTierId: tier.id,
          amount: 0,
        },
      });

      const response = await requestApp
        .post(`users/${user.id}/artists/${artist.id}/subscribers`)
        .send({
          subscribers: [
            {
              email: subscriberEmail,
            },
          ],
        })
        .set("Cookie", [`jwt=${accessToken}`])
        .set("Accept", "application/json");

      assert.equal(response.statusCode, 200);

      const created = await prisma.user.findFirst({
        where: {
          email: subscriberEmail,
        },
      });

      assert.notEqual(created, null);
    });
  });
});
