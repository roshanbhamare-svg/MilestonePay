import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { register, login } from "../src/controllers/authController.js";

function createMockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

describe("authController configuration boundaries", () => {
  it("fails fast with 503 before creating a user if JWT_SECRET is missing", async () => {
    const prevSecret = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;

    try {
      const regRes = createMockRes();
      await register(
        {
          body: {
            name: "Test User",
            email: "test@example.com",
            password: "password123",
            role: "client",
          },
        },
        regRes
      );
      assert.equal(regRes.statusCode, 503);
      assert.equal(regRes.body.success, false);
      assert.match(regRes.body.error, /JWT_SECRET/i);

      const loginRes = createMockRes();
      await login(
        {
          body: {
            email: "test@example.com",
            password: "password123",
          },
        },
        loginRes
      );
      assert.equal(loginRes.statusCode, 503);
      assert.equal(loginRes.body.success, false);
      assert.match(loginRes.body.error, /JWT_SECRET/i);
    } finally {
      if (prevSecret !== undefined) {
        process.env.JWT_SECRET = prevSecret;
      }
    }
  });
});

