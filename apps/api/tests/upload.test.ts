import { ALLOWED_IMAGE_EXTENSIONS, ALLOWED_IMAGE_MIME_TYPES, UPLOAD_BUCKETS } from "../utils/upload";
import { canUserUploadToBucket } from "../modules/uploads/routes/uploads.routes";

type UploadAccessUser = Parameters<typeof canUserUploadToBucket>[0];

function makeUser(overrides: Partial<UploadAccessUser> = {}): UploadAccessUser {
  return {
    is_owner: false,
    is_admin: false,
    two_factor_enabled: false,
    is_seller: false,
    seller_access: false,
    ...overrides,
  };
}

describe("upload utils", () => {
  test("does not allow svg uploads", () => {
    expect(ALLOWED_IMAGE_MIME_TYPES.has("image/svg+xml")).toBe(false);
    expect(ALLOWED_IMAGE_EXTENSIONS.has(".svg")).toBe(false);
  });

  test("allows regular authenticated users to upload only personal and support images", () => {
    const user = makeUser({});

    expect(canUserUploadToBucket(user, UPLOAD_BUCKETS.support)).toBe(true);
    expect(canUserUploadToBucket(user, UPLOAD_BUCKETS.avatars)).toBe(true);
    expect(canUserUploadToBucket(user, UPLOAD_BUCKETS.sellerAvatars)).toBe(true);
    expect(canUserUploadToBucket(user, UPLOAD_BUCKETS.sellerBanners)).toBe(true);
    expect(canUserUploadToBucket(user, UPLOAD_BUCKETS.products)).toBe(false);
    expect(canUserUploadToBucket(user, UPLOAD_BUCKETS.tiles)).toBe(false);
    expect(canUserUploadToBucket(user, UPLOAD_BUCKETS.misc)).toBe(false);
  });

  test("allows sellers to upload product images", () => {
    expect(canUserUploadToBucket(makeUser({ is_seller: true }), UPLOAD_BUCKETS.products)).toBe(true);
    expect(canUserUploadToBucket(makeUser({ seller_access: true }), UPLOAD_BUCKETS.products)).toBe(true);
  });

  test("requires 2FA for privileged catalog and system uploads", () => {
    const adminWithout2fa = makeUser({ is_admin: true, two_factor_enabled: false });
    const adminWith2fa = makeUser({ is_admin: true, two_factor_enabled: true });
    const ownerWith2fa = makeUser({ is_owner: true, two_factor_enabled: true });

    expect(canUserUploadToBucket(adminWithout2fa, UPLOAD_BUCKETS.products)).toBe(false);
    expect(canUserUploadToBucket(adminWithout2fa, UPLOAD_BUCKETS.tiles)).toBe(false);
    expect(canUserUploadToBucket(adminWithout2fa, UPLOAD_BUCKETS.misc)).toBe(false);

    expect(canUserUploadToBucket(adminWith2fa, UPLOAD_BUCKETS.products)).toBe(true);
    expect(canUserUploadToBucket(adminWith2fa, UPLOAD_BUCKETS.tiles)).toBe(true);
    expect(canUserUploadToBucket(adminWith2fa, UPLOAD_BUCKETS.misc)).toBe(true);

    expect(canUserUploadToBucket(ownerWith2fa, UPLOAD_BUCKETS.products)).toBe(true);
    expect(canUserUploadToBucket(ownerWith2fa, UPLOAD_BUCKETS.tiles)).toBe(true);
    expect(canUserUploadToBucket(ownerWith2fa, UPLOAD_BUCKETS.misc)).toBe(true);
  });
});
