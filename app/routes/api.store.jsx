import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  try {
    const response = await admin.rest.resources.Shop.all({
      session: admin.session,
    });

    return {
      store: response.data[0],
    };
  } catch (error) {
    console.error("Error fetching store information:", error);
    return new Response(JSON.stringify({ error: "Failed to fetch store information" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
}; 