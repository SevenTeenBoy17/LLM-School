import { DatabaseSync } from "node:sqlite";
import assert from "node:assert/strict";
import { startResearchSnapshot } from "./research-workspace-server.mjs";

export function apiClient(base) {
  let cookie = "";
  return async (path, method = "GET", data, extra = {}) => {
    const response = await fetch(`${base}${path}`, { method, headers: { cookie, ...(method === "GET" ? {} : { "content-type": "application/json", origin: base }), ...extra }, ...(data === undefined ? {} : { body: typeof data === "string" ? data : JSON.stringify(data) }) });
    const setCookie = response.headers.getSetCookie();
    if (setCookie.length) cookie = setCookie.map(c => c.split(";", 1)[0]).join("; ");
    const body = await response.json().catch(() => null);
    return { status: response.status, body, headers: response.headers };
  };
}
export async function groupFixture() {
  const server = await startResearchSnapshot();
  try {
    const owner = apiClient(server.base);
    assert.equal((await owner("/api/auth/login", "POST", { username: "teacher", password: "Teacher@123" })).status, 200);
    const db = new DatabaseSync(server.dbPath);
    // Synthetic identities are created only inside the isolated, disposable test database.
    const teacher = db.prepare("SELECT salt,passwordHash FROM users WHERE id='u-teacher'").get();
    const names = ["林清和", "沈知行", "周明远", "何书宁", "许知夏", "唐星禾", "陆景安", "苏云舒", "段木宇", "欧阳墨言长姓名测试"];
    for (let i = 0; i < names.length; i++) db.prepare("INSERT INTO users (id,username,salt,passwordHash,name,role,stage,classId,avatarLetter,department,sessionVersion) VALUES (?,?,?,?,?,'teacher','junior','c1',?,'科学教研组',1)").run(`rg-test-${i}`, `rgtest${i}`, teacher.salt, teacher.passwordHash, names[i], names[i].slice(0, 1));
    db.close();
    const members = [];
    for (let i = 0; i < names.length; i++) {
      const client = apiClient(server.base);
      assert.equal((await client("/api/auth/login", "POST", { username: `rgtest${i}`, password: "Teacher@123" })).status, 200);
      members.push(client);
    }
    return { ...server, owner, members, names };
  } catch (error) { await server.cleanup(); throw error; }
}
