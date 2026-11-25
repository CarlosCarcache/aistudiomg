import { describe, it } from "node:test";
import { strict as assert } from "node:assert";

const token = process.env.SHARED_GALLERY_TEST_TOKEN;
const creator = process.env.SHARED_GALLERY_TEST_CREATOR;
const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

async function rpc(name: string, body: unknown) {
  if (!url || !key) throw new Error("Missing test configuration");
  return fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("shared category capability", { skip: !token || !creator }, () => {
  it("includes both folder images even when another authorized account uploaded them", async () => {
    const response = await rpc("get_shared_gallery", { _token: token });
    assert.equal(response.status, 200);
    const images = (await response.json()) as { user_id: string }[];
    assert.equal(images.length, 2);
    assert.ok(images.some((image) => image.user_id !== creator));
  });

  it("rejects order selections outside the shared folder", async () => {
    const response = await rpc("create_shared_gallery_order", {
      _token: token,
      _client_name: "Verificación de permisos",
      _phone: "",
      _notes: "",
      _image_ids: ["00000000-0000-4000-8000-000000000001"],
    });
    assert.equal(response.status, 400);
    const error = (await response.json()) as { message: string };
    assert.equal(error.message, "Las imágenes no pertenecen a este enlace");
  });

  it("returns the saved client for the shared link", async () => {
    const response = await rpc("get_shared_gallery_client", { _token: token });
    assert.equal(response.status, 200);
    const clients = (await response.json()) as {
      owner_id: string;
      client_id: string;
      first_name: string;
    }[];
    assert.equal(clients.length, 1);
    assert.equal(clients[0]?.owner_id, creator);
    assert.ok(clients[0]?.client_id);
    assert.ok(clients[0]?.first_name);
  });

  it("rejects quote selections outside the shared folder", async () => {
    const response = await rpc("create_shared_gallery_quote", {
      _token: token,
      _notes: "",
      _image_path: "",
      _image_name: "",
      _image_ids: ["00000000-0000-4000-8000-000000000001"],
    });
    assert.equal(response.status, 400);
    const error = (await response.json()) as { message: string };
    assert.equal(error.message, "Las imágenes no pertenecen a este enlace");
  });
});
