import { useEffect, useState } from "react";
import { Spinner } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { CurrencySelector } from "../components/CurrencySelector";
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

export default function Index() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch("/api/first-visit")
      .then(response => response.json())
      .then(result => {
        setData(result);
        if (result.isFirstVisit) {
          const pricingUrl = `https://admin.shopify.com/store/${result.shopHandle}/charges/currency-converter-vento/pricing_plans`;
          window.open(pricingUrl, '_blank');
        }
        setLoading(false);
      })
      .catch(error => {
        console.error("Error checking first visit:", error);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "2rem" }}>
        <Spinner size="large" />
      </div>
    );
  }

  return <CurrencySelector />;
}
