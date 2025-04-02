import { Page, Layout, Card, Text, BlockStack, Button, Link } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { useLoaderData } from "@remix-run/react";
import { json } from "@remix-run/node";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  
  // Get shop data from session
  const shopHandle = session.shop.replace(".myshopify.com", "");
  
  return json({
    shopHandle
  });
};

export default function Pricing() {
  const { shopHandle } = useLoaderData();
  
  const pricingUrl = `https://admin.shopify.com/store/${shopHandle}/charges/currency-converter-vento/pricing_plans`;

  return (
    <Page>
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400" padding="400">
              <Text variant="headingXl" as="h1">Welcome to Currency Converter</Text>
              <Text as="p" variant="bodyLg">
                Thank you for choosing our Currency Converter app. To get started, please select your preferred pricing plan.
              </Text>
              <Button
                variant="primary"
                url={pricingUrl}
                target="_blank"
                external
              >
                View Pricing Plans
              </Button>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
} 