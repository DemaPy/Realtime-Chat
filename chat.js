import express from "express";
import { createServer } from "node:http";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import { Server } from "socket.io";
import sqlite3 from "sqlite3";
import { open } from "sqlite";

const db = await open({
  filename: "chat.db",
  driver: sqlite3.Database,
});

await db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_offset TEXT UNIQUE,
      content TEXT
  );
`);

const app = express();
const server = createServer(app);
const io = new Server(server, {
  // Connection state recovery
  connectionStateRecovery: {},
});

const __dirname = dirname(fileURLToPath(import.meta.url));

app.get("/", (req, res) => {
  res.sendFile(join(__dirname, "index.html"));
});

io.on("connection", async (socket) => {
  console.log("a user connected");

  if ("PARTICULAR USER WANT JOIN TO ROOM") {
    // ADD USER TO ROOM
    socket.join("some room");

    // broadcast to all connected clients in the room
    io.to("some room").emit("hello", "world");

    // broadcast to all connected clients except those in the room
    io.except("some room").emit("hello", "world");

    // leave the room
    socket.leave("some room");
  }

  socket.on("chat_message", async (payload, cb) => {
    // SAVE TO DB
    let result;
    try {
      // store the message in the database
      result = await db.run("INSERT INTO messages (content) VALUES (?)", msg);
    } catch (e) {
      if (e.errno === 19 /* SQLITE_CONSTRAINT */) {
      }
      return;
    }
    // NOTIFY USERS
    // include the offset with the message
    socket.broadcast.emit(
      "notify_users",
      { value: payload.value },
      result.lastID
    );
    cb({
      status: "ok",
    });
  });

  if (!socket.recovered) {
    // if the connection state recovery was not successful
    try {
      await db.each(
        "SELECT id, content FROM messages WHERE id > ?",
        [socket.handshake.auth.serverOffset || 0],
        (_err, row) => {
          socket.emit("chat message", row.content, row.id);
        }
      );
    } catch (e) {
      // something went wrong
      console.log("something went wrong");
    }
  }

  socket.onAny((eventName, ...args) => {
    const FILE_PATH = "./db/LOG_TABLE.json";
    fs.readFile(FILE_PATH, "utf-8", (err, data) => {
      if (err) {
        console.error(err);
      } else {
        // file written successfully
        const JSON_DATA = JSON.parse(data || "{}");
        let NEW_JSON_DATA;
        if (JSON_DATA && eventName in JSON_DATA) {
          NEW_JSON_DATA = {
            [eventName]: [...JSON_DATA[eventName], args],
          };
        } else {
          NEW_JSON_DATA = {
            [eventName]: [args],
          };
        }
        fs.writeFile(FILE_PATH, JSON.stringify(NEW_JSON_DATA), (err) => {
          if (err) {
            console.error(err);
          } else {
            // file written successfully
          }
        });
      }
    });
  });

  socket.on("disconnect", () => {
    console.log("user disconnected");
  });
});

server.listen(3000, () => {
  console.log("Server has been started");
});
