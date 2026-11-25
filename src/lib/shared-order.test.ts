import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { sharedOrderSchema, sharedImageTotal, sharedQuoteSchema } from "./shared-order";

describe("shared gallery orders", () => {
  it("adds each selected image price once", () => {
    assert.equal(sharedImageTotal([{ price: 100 }, { price: 250 }]), 350);
  });
  it("rejects selections without images", () => {
    assert.equal(
      sharedOrderSchema.safeParse({ name: "Cliente", phone: "", notes: "", imageIds: [] }).success,
      false,
    );
  });

  it("accepts a quote with only an uploaded image", () => {
    assert.equal(
      sharedQuoteSchema.safeParse({
        notes: "Dos camisetas talla M",
        imageName: "referencia.png",
        imageDataUrl: "data:image/png;base64,iVBORw0KGgo=",
        imageIds: [],
      }).success,
      true,
    );
  });

  it("accepts a quote with only a shared image", () => {
    assert.equal(
      sharedQuoteSchema.safeParse({
        notes: "",
        imageName: "",
        imageDataUrl: "",
        imageIds: ["00000000-0000-4000-8000-000000000001"],
      }).success,
      true,
    );
  });

  it("rejects a quote without either image source", () => {
    const result = sharedQuoteSchema.safeParse({
      notes: "",
      imageName: "",
      imageDataUrl: "",
      imageIds: [],
    });
    assert.equal(result.success, false);
    assert.equal(
      result.error?.issues[0]?.message,
      "Adjunta una imagen o selecciona una imagen compartida",
    );
  });

  it("rejects repeated shared images in a quote", () => {
    assert.equal(
      sharedQuoteSchema.safeParse({
        notes: "",
        imageName: "",
        imageDataUrl: "",
        imageIds: ["00000000-0000-4000-8000-000000000001", "00000000-0000-4000-8000-000000000001"],
      }).success,
      false,
    );
  });
});
