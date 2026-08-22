import { createHash } from "node:crypto";
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";

const dynamodb = new DynamoDBClient({});
const ses = new SESv2Client({});
const allowedOrigins = new Set(
  (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
);
const emailAddress = process.env.EMAIL_ADDRESS;
const rateLimitTable = process.env.RATE_LIMIT_TABLE;

const response = (statusCode, message) => ({
  statusCode,
  headers: { "content-type": "application/json; charset=utf-8" },
  body: JSON.stringify({ message }),
});

const clean = (value, maxLength) =>
  typeof value === "string" ? value.trim().slice(0, maxLength) : "";

export const handler = async (event) => {
  const origin = event.headers?.origin || event.headers?.Origin;
  if (!origin || !allowedOrigins.has(origin)) {
    return response(403, "Origin not allowed.");
  }

  let rawBody = event.body || "";
  if (event.isBase64Encoded) rawBody = Buffer.from(rawBody, "base64").toString("utf8");
  if (Buffer.byteLength(rawBody, "utf8") > 20_000) {
    return response(413, "Message is too large.");
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return response(400, "Invalid request.");
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return response(400, "Invalid request.");
  }

  // Silently accept bot submissions that fill the hidden field.
  if (clean(payload.website, 200)) return response(200, "Message received.");

  const name = clean(payload.name, 100);
  const replyTo = clean(payload.email, 254).toLowerCase();
  const topic = (clean(payload.topic, 80) || "General enquiry").replace(/[\r\n]+/g, " ");
  const message = clean(payload.message, 5_000);
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(replyTo);

  if (name.length < 2 || !validEmail || message.length < 10) {
    return response(400, "Please complete every required field.");
  }

  const sourceIp = event.requestContext?.http?.sourceIp || "unknown";
  const ipHash = createHash("sha256").update(sourceIp).digest("hex");
  const now = Math.floor(Date.now() / 1000);

  try {
    await dynamodb.send(
      new PutItemCommand({
        TableName: rateLimitTable,
        Item: {
          ipHash: { S: ipHash },
          expiresAt: { N: String(now + 60) },
        },
        ConditionExpression: "attribute_not_exists(ipHash) OR expiresAt < :now",
        ExpressionAttributeValues: { ":now": { N: String(now) } },
      }),
    );
  } catch (error) {
    if (error.name === "ConditionalCheckFailedException") {
      return response(429, "Please wait a minute before sending another message.");
    }
    console.error("Contact rate-limit check failed", { requestId: event.requestContext?.requestId, error: error.name });
    return response(500, "We could not send your message. Please try again.");
  }

  const body = [
    "New Agent Pair website enquiry",
    "",
    `Topic: ${topic}`,
    `Name: ${name}`,
    `Reply to: ${replyTo}`,
    "",
    message,
  ].join("\n");

  try {
    await ses.send(
      new SendEmailCommand({
        FromEmailAddress: emailAddress,
        Destination: { ToAddresses: [emailAddress] },
        ReplyToAddresses: [replyTo],
        Content: {
          Simple: {
            Subject: { Data: `[Agent Pair contact] ${topic}`, Charset: "UTF-8" },
            Body: { Text: { Data: body, Charset: "UTF-8" } },
          },
        },
      }),
    );
  } catch (error) {
    console.error("Contact email failed", { requestId: event.requestContext?.requestId, error: error.name });
    return response(500, "We could not send your message. Please try again.");
  }

  console.log("Contact message sent", { requestId: event.requestContext?.requestId, topic });
  return response(200, "Thanks — your message has been sent.");
};
