import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  try {
    // Check if there are any metafields for the app
    const response = await admin.graphql(
      `#graphql
        query {
          shop {
            metafields(first: 1) {
              edges {
                node {
                  id
                }
              }
            }
          }
        }
      `
    );

    const responseJson = await response.json();
    const hasMetafields = responseJson.data.shop.metafields.edges.length > 0;

    return {
      isFirstVisit: !hasMetafields,
    };
  } catch (error) {
    console.error("Error checking first visit:", error);
    return new Response(JSON.stringify({ error: "Failed to check first visit" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
}; 