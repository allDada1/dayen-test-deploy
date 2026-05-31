import type { Pool } from "pg";

import { createAdminSellerRequestsRepository } from "../repositories/admin-seller-requests.repository";

export function createAdminSellerRequestsService(pool: Pool) {
  const repository = createAdminSellerRequestsRepository(pool);

  return {
    async listRequests() {
      return repository.listRequests();
    },

    async approveRequest(id: number) {
      return repository.withTransaction(async (client) => {
        const request = await repository.approveRequest(client, id);
        if (!request) return null;

        await repository.applyApprovedSeller(client, request);
        return request;
      });
    },

    async rejectRequest(id: number, adminComment: string) {
      return repository.rejectRequest(id, adminComment);
    },

    async revokeRequest(id: number, adminComment: string) {
      return repository.withTransaction(async (client) => {
        const request = await repository.findRequest(client, id);
        if (!request) return null;

        await repository.revokeSeller(client, request.user_id);
        await repository.markRequestReviewed(
          client,
          id,
          adminComment || "Доступ продавца снят администратором",
        );

        return request;
      });
    },

    async restoreRequest(id: number, adminComment: string) {
      return repository.withTransaction(async (client) => {
        const request = await repository.findRequest(client, id);
        if (!request) return null;

        await repository.restoreSeller(client, request.user_id);
        await repository.markRequestApprovedAgain(
          client,
          id,
          adminComment || "Доступ продавца восстановлен администратором",
        );

        return request;
      });
    },
  };
}
