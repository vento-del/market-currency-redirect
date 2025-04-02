import { Page, Layout, Card, Text, BlockStack, Button, Link, Box, InlineStack } from "@shopify/polaris";
import { CurrencySelector } from "../components/CurrencySelector";
import { authenticate } from "../shopify.server";
import { useState, useEffect } from "react";
import { useLoaderData } from "@remix-run/react";
import { json } from "@remix-run/node";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  
  // Get shop data from session
  const shop = session.shop.replace(".myshopify.com", "");

  // Fetch currency formats
  const response = await admin.graphql(
    `#graphql
      query {
        shop {
          currencyFormats {
            moneyFormat
            moneyWithCurrencyFormat
          }
        }
      }
    `
  );

  const responseJson = await response.json();
  const currencyFormats = responseJson.data.shop.currencyFormats;
  
  return json({
    shop,
    currencyFormats
  });
};

export default function Dashboard() {
  useEffect(() => {
    const script1 = document.createElement("script");
    script1.innerHTML = "window.$zoho=window.$zoho || {};$zoho.salesiq=$zoho.salesiq||{ready:function(){}}";
    document.body.appendChild(script1);

    const script2 = document.createElement("script");
    script2.src = "https://salesiq.zohopublic.in/widget?wc=siq8db097391d7cb2f1c66fd31d72e60937f22ac00d3895c6e3f03078db00b002a6";
    script2.id = "zsiqscript";
    script2.defer = true;
    document.body.appendChild(script2);
  }, []);
  
  const { shop, currencyFormats } = useLoaderData();
  const [copied, setCopied] = useState("");
  const [processedFormats, setProcessedFormats] = useState({
    withCurrency: "",
    withoutCurrency: ""
  });

  useEffect(() => {
    // Decode HTML entities
    const decodeHtmlEntities = (str) => {
      const textarea = document.createElement('textarea');
      textarea.innerHTML = str;
      return textarea.value;
    };
    
    // Strip any HTML tags from the currency format
    const stripHtml = (str) => str.replace(/<[^>]*>/g, '');
    
    // Check if the format already contains currency-changer span
    const hasCurrencyChanger = (str) => str.includes('class="currency-changer"');
    
    // Process the currency formats
    const processFormat = (format) => {
      // First decode any HTML entities
      const decodedFormat = decodeHtmlEntities(format);
      // Then check if it already has currency-changer
      if (hasCurrencyChanger(decodedFormat)) {
        return decodedFormat;
      }
      // If no currency-changer, strip HTML and add the span
      const strippedFormat = stripHtml(decodedFormat);
      return `<span class="currency-changer">${strippedFormat}</span>`;
    };
    
    // Process and set the formats
    setProcessedFormats({
      withCurrency: processFormat(currencyFormats.moneyWithCurrencyFormat),
      withoutCurrency: processFormat(currencyFormats.moneyFormat)
    });
  }, [currencyFormats]);

  const handleCopy = (text, type) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(""), 2000);
  };

  const themeEditorUrl = `https://${shop}.myshopify.com/admin/themes/current/editor?context=apps&template=index&activateAppId=010de1f3-20a8-4c27-8078-9d5535ccae26/helloCurrency`;

  return (
    <Page>
      <BlockStack gap="500">
        <Text variant="headingXl" as="h1">Dashboard</Text>
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400" padding="400">
                <Text variant="headingLg" as="h2">
                  Step 1: Set up money format
                </Text>
                <Text as="p" variant="bodyMd">
                  This option allows you to set the money format of your store, which is essential for the app to function seamlessly.
                </Text>
                <Text as="p" variant="headingLg">
                  Steps to Follow
                </Text>
                <BlockStack gap="300">
                  <Text as="p">
                    Go to{" "}
                    <Link url="https://admin.shopify.com/store/teststorecvd/settings/general#currency-display" target="_blank">
                      Shopify Settings {'->'} General
                    </Link>
                  </Text>
                  <Text as="p">Under Store Currency section, select Change formatting</Text>
                  <Text as="p">Copy & Paste the below modified Money Formats to HTML with currency and HTML without currency section</Text>
                  <Text as="p">Click Save button on right top of the screen</Text>
                </BlockStack>

                <Box paddingBlockStart="400">
                  <BlockStack gap="400">
                    <Box>
                      <BlockStack gap="200">
                        <Text variant="headingMd" as="h3">HTML with currency</Text>
                        <Box background="bg-surface-secondary" padding="300" borderRadius="200">
                          <InlineStack align="space-between">
                            <Text as="span" variant="bodyLg">{processedFormats.withCurrency}</Text>
                            <Button
                              onClick={() => handleCopy(processedFormats.withCurrency, "with")}
                              variant="plain"
                            >
                              {copied === "with" ? "Copied!" : "Copy"}
                            </Button>
                          </InlineStack>
                        </Box>
                      </BlockStack>
                    </Box>

                    <Box>
                      <BlockStack gap="200">
                        <Text variant="headingMd" as="h3">HTML without currency</Text>
                        <Box background="bg-surface-secondary" padding="300" borderRadius="200">
                          <InlineStack align="space-between">
                            <Text as="span" variant="bodyLg">{processedFormats.withoutCurrency}</Text>
                            <Button
                              onClick={() => handleCopy(processedFormats.withoutCurrency, "without")}
                              variant="plain"
                            >
                              {copied === "without" ? "Copied!" : "Copy"}
                            </Button>
                          </InlineStack>
                        </Box>
                      </BlockStack>
                    </Box>
                  </BlockStack>
                </Box>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section>
            <Card>
              <BlockStack gap="400" padding="400">
                <Text variant="headingLg" as="h2">
                  Step 2: Select Currency
                </Text>
                <CurrencySelector />
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section>
            <Card>
              <BlockStack gap="400" padding="400">
                <Text variant="headingLg" as="h2">
                  Step 3: Theme Editor Access
                </Text>
                <Text as="p" variant="bodyLg">
                  Click below to add currency selector to your website
                </Text>
                <Button
                  variant="primary"
                  url={themeEditorUrl}
                  target="_blank"
                  external
                >
                  Add Currency Selector
                </Button>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
} 