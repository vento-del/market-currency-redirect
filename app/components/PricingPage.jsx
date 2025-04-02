import { useEffect, useState } from "react";
import {
  Page,
  Layout,
  Card,
  Text,
  Spinner,
  Banner,
  BlockStack,
} from "@shopify/polaris";

export function PricingPage() {
  const [storeHandle, setStoreHandle] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Fetch store information
    fetch("/api/store")
      .then((response) => response.json())
      .then((data) => {
        if (data.store) {
          setStoreHandle(data.store.handle);
        }
        setLoading(false);
      })
      .catch((error) => {
        console.error("Error fetching store information:", error);
        setError("Failed to load store information");
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

  if (error) {
    return (
      <Page>
        <Banner status="critical">{error}</Banner>
      </Page>
    );
  }

  const pricingUrl = `https://admin.shopify.com/store/${storeHandle}/charges/currency-converter-vento/pricing_plans`;

  return (
    <Page>
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            <Card>
              <div style={{ padding: "24px" }}>
                <Text variant="headingLg" as="h1">
                  Welcome to Currency Converter
                </Text>
                <div style={{ marginTop: "16px" }}>
                  <Text as="p" variant="bodyLg">
                    To use the Currency Converter app, you must first select and subscribe to a pricing plan.
                  </Text>
                  <div style={{ marginTop: "8px" }}>
                    <Banner status="warning">
                      Please select a pricing plan below to continue. The app features will be unlocked after subscription.
                    </Banner>
                  </div>
                </div>
              </div>
            </Card>

            <Card>
              <div style={{ padding: "24px" }}>
                <Text variant="headingMd" as="h2">
                  Select Your Plan
                </Text>
                <div style={{ marginTop: "16px", height: "800px" }}>
                  <iframe
                    src={pricingUrl}
                    style={{
                      width: "100%",
                      height: "100%",
                      border: "none",
                    }}
                    title="Pricing Plans"
                  />
                </div>
              </div>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
} 