import { authenticate } from "../shopify.server";
import { json } from "@remix-run/node";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  
  // Get shop handle from session
  const shopHandle = session.shop.replace(".myshopify.com", "");
  
  // Check if this is first visit by checking for metafields
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

  return json({
    isFirstVisit: !hasMetafields,
    shopHandle
  });
}; 