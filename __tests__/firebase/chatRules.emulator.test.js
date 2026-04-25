const fs = require("fs");
const path = require("path");
const {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} = require("@firebase/rules-unit-testing");
const { doc, getDoc, setDoc, updateDoc } = require("firebase/firestore");
const { getBytes, ref, uploadString } = require("firebase/storage");

const projectId = `snapstyle-rules-${Date.now()}`;

let testEnv;

function readRules(relativePath) {
  return fs.readFileSync(
    path.join(__dirname, "..", "..", relativePath),
    "utf8",
  );
}

function authed(uid) {
  return testEnv.authenticatedContext(uid);
}

function unauthenticated() {
  return testEnv.unauthenticatedContext();
}

async function seedFirestore() {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "Chats/chatA"), {
      members: ["alice", "bob"],
      createdAt: new Date(),
    });
    await setDoc(doc(db, "Chats/chatA/Messages/msg1"), {
      senderId: "alice",
      kind: "text",
      text: "hello",
      createdAt: Date.now(),
    });
    await setDoc(doc(db, "Groups/groupA"), {
      name: "Group A",
      ownerId: "alice",
      createdBy: "alice",
      memberIds: ["alice", "bob"],
      memberCount: 2,
    });
    await setDoc(doc(db, "Groups/groupA/Members/alice"), {
      uid: "alice",
      role: "owner",
    });
    await setDoc(doc(db, "Groups/groupA/Members/bob"), {
      uid: "bob",
      role: "member",
    });
    await setDoc(doc(db, "Groups/groupA/Messages/msg1"), {
      senderId: "alice",
      kind: "text",
      text: "group hello",
      createdAt: Date.now(),
    });
    await setDoc(doc(db, "Groups/groupRemoved"), {
      name: "Removed Group",
      ownerId: "alice",
      createdBy: "alice",
      memberIds: ["alice"],
      memberCount: 1,
    });
    await setDoc(doc(db, "Groups/groupRemoved/Members/alice"), {
      uid: "alice",
      role: "owner",
    });
  });
}

async function seedStorage() {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const storage = context.storage();
    await uploadString(
      ref(storage, "groups/groupA/messages/existing.jpg"),
      "ok",
      "raw",
      {
        contentType: "image/jpeg",
      },
    );
    await uploadString(
      ref(storage, "groups/groupRemoved/messages/existing.jpg"),
      "ok",
      "raw",
      {
        contentType: "image/jpeg",
      },
    );
  });
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: {
      rules: readRules("firebase-backend/firestore.rules"),
      host: "127.0.0.1",
      port: 8080,
    },
    storage: {
      rules: readRules("firebase-backend/storage.rules"),
      host: "127.0.0.1",
      port: 9199,
    },
  });
  await seedFirestore();
  await seedStorage();
});

afterAll(async () => {
  if (testEnv) {
    await testEnv.cleanup();
  }
});

describe("Firestore chat membership/message rules", () => {
  test("unauthenticated users cannot read chat messages", async () => {
    const db = unauthenticated().firestore();
    await assertFails(getDoc(doc(db, "Chats/chatA/Messages/msg1")));
  });

  test("members can read their DM and group messages", async () => {
    const db = authed("bob").firestore();
    await assertSucceeds(getDoc(doc(db, "Chats/chatA/Messages/msg1")));
    await assertSucceeds(getDoc(doc(db, "Groups/groupA/Messages/msg1")));
  });

  test("non-members cannot read private DM or group messages", async () => {
    const db = authed("mallory").firestore();
    await assertFails(getDoc(doc(db, "Chats/chatA/Messages/msg1")));
    await assertFails(getDoc(doc(db, "Groups/groupA/Messages/msg1")));
  });

  test("users cannot send as another senderId", async () => {
    const db = authed("bob").firestore();
    await assertFails(
      setDoc(doc(db, "Chats/chatA/Messages/badSender"), {
        senderId: "alice",
        kind: "text",
        text: "spoof",
        createdAt: Date.now(),
      }),
    );
  });

  test("non-members cannot write into a group", async () => {
    const db = authed("mallory").firestore();
    await assertFails(
      setDoc(doc(db, "Groups/groupA/Messages/nope"), {
        senderId: "mallory",
        kind: "text",
        text: "nope",
        createdAt: Date.now(),
      }),
    );
  });

  test("users cannot mutate another user's inbox/read state", async () => {
    const db = authed("mallory").firestore();
    await assertFails(
      updateDoc(doc(db, "Chats/chatA/Members/bob"), {
        lastReadAtPublic: Date.now(),
      }),
    );
  });
});

describe("Storage chat media rules", () => {
  test("unauthenticated users cannot read private group media", async () => {
    const storage = unauthenticated().storage();
    await assertFails(
      getBytes(ref(storage, "groups/groupA/messages/existing.jpg")),
    );
  });

  test("group members can read private group media", async () => {
    const storage = authed("bob").storage();
    await assertSucceeds(
      getBytes(ref(storage, "groups/groupA/messages/existing.jpg")),
    );
  });

  test("removed or non-members cannot read private group media", async () => {
    const storage = authed("bob").storage();
    await assertFails(
      getBytes(ref(storage, "groups/groupRemoved/messages/existing.jpg")),
    );
  });

  test("non-members cannot upload into group media paths", async () => {
    const storage = authed("mallory").storage();
    await assertFails(
      uploadString(
        ref(storage, "groups/groupA/messages/nope.jpg"),
        "x",
        "raw",
        {
          contentType: "image/jpeg",
        },
      ),
    );
  });

  test("members cannot upload invalid content types", async () => {
    const storage = authed("bob").storage();
    await assertFails(
      uploadString(
        ref(storage, "groups/groupA/messages/nope.exe"),
        "x",
        "raw",
        {
          contentType: "application/x-msdownload",
        },
      ),
    );
  });

  test("members can upload valid staged media", async () => {
    const storage = authed("bob").storage();
    await assertSucceeds(
      uploadString(
        ref(storage, "chat-staging/group/groupA/msg2/att1.jpg"),
        "x",
        "raw",
        { contentType: "image/jpeg" },
      ),
    );
  });
});
