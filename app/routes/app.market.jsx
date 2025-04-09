import { json } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  Box,
  DataTable,
  Banner,
  Modal,
  Button,
  Link,
  InlineStack,
} from "@shopify/polaris";
import { useState, useCallback, useEffect } from "react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  try {
    const response = await admin.graphql(`
      #graphql
      query {
        shop {
          name
          id
          currencyFormats {
            moneyFormat
            moneyWithCurrencyFormat
          }
        }
        markets(first: 50) {
          edges {
            node {
              id
              name
              primary
              enabled
              currencySettings {
                baseCurrency {
                  currencyCode
                }
              }
              regions(first: 220) {
                edges {
                  node {
                    ... on MarketRegionCountry {
                      id
                      name
                      code
                    }
                  }
                }
              }
              metafields(first: 10, namespace: "markeet") {
                edges {
                  node {
                    id
                    namespace
                    key
                    value
                  }
                }
              }
            }
          }
        }
      }
    `);

    const jsonData = await response.json();
    console.log("Full GraphQL response:", JSON.stringify(jsonData, null, 2));

    if (jsonData.errors) {
      return json({
        markets: [],
        errors: jsonData.errors,
        shopInfo: jsonData.data?.shop || null,
      });
    }

    const markets = jsonData.data.markets.edges.map((edge) => edge.node);

    return json({
      markets,
      shopInfo: jsonData.data.shop,
      currencyFormats: jsonData.data.shop.currencyFormats,
    });
  } catch (error) {
    console.error("Error fetching markets:", error);
    return json({ markets: [], error: error.message });
  }
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const shopId = formData.get("shopId");

  try {
    // Check if we're saving all markets data or just a single market
    if (formData.has("allMarketsData")) {
      // Handle saving all markets data
      const allMarketsData = JSON.parse(formData.get("allMarketsData"));

      // Create a metafield value with all markets data
      const allMarketsMetafield = JSON.stringify(allMarketsData);

      // Save to shop metafield
      const response = await admin.graphql(`
        #graphql
        mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
          metafieldsSet(metafields: $metafields) {
            metafields {
              id
              namespace
              key
              value
            }
            userErrors {
              field
              message
            }
          }
        }
      `, {
        variables: {
          metafields: [
            {
              ownerId: shopId,
              namespace: "markeet",
              key: "all_markets_data",
              value: allMarketsMetafield,
              type: "json"
            }
          ]
        }
      });

      const responseJson = await response.json();

      if (responseJson.errors || responseJson.data?.metafieldsSet?.userErrors?.length > 0) {
        return json({
          success: false,
          errors: responseJson.errors || responseJson.data?.metafieldsSet?.userErrors
        });
      }

      return json({ success: true });
    } else {
      // Handle saving a single market
      const marketId = formData.get("marketId");
      const selectedCurrency = formData.get("selectedCurrency");
      const countries = JSON.parse(formData.get("countries"));
      const marketName = formData.get("marketName") || "";

      // Create a simplified metafield value with only essential data
      const metafieldValue = JSON.stringify({
        currency: selectedCurrency,
        marketName: marketName,
        countries: countries
      });

      // Create a simplified metafield with only essential data
      const selectedValueMetafield = JSON.stringify({
        currency: selectedCurrency,
        marketName: marketName,
        countries: countries.map(country => country.code).join(",")
      });

      // Save to metafield
      const response = await admin.graphql(`
        #graphql
        mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
          metafieldsSet(metafields: $metafields) {
            metafields {
              id
              namespace
              key
              value
            }
            userErrors {
              field
              message
            }
          }
        }
      `, {
        variables: {
          metafields: [
            {
              ownerId: marketId,
              namespace: "markeet",
              key: "currency_settings",
              value: metafieldValue,
              type: "json"
            },
            {
              ownerId: shopId,
              namespace: "markeet",
              key: "selectedvalue",
              value: selectedValueMetafield,
              type: "json"
            }
          ]
        }
      });

      const responseJson = await response.json();

      if (responseJson.errors || responseJson.data?.metafieldsSet?.userErrors?.length > 0) {
        return json({
          success: false,
          errors: responseJson.errors || responseJson.data?.metafieldsSet?.userErrors
        });
      }

      return json({ success: true });
    }
  } catch (error) {
    console.error("Error saving metafield:", error);
    return json({ success: false, error: error.message });
  }
};

export default function MarketPage() {
  const { markets, errors, error, shopInfo, currencyFormats } = useLoaderData();
  const fetcher = useFetcher();
  const [modalActive, setModalActive] = useState(false);
  const [selectedCountries, setSelectedCountries] = useState([]);
  const [modalTitle, setModalTitle] = useState("");

  // For currency change modal
  const [currencyModalActive, setCurrencyModalActive] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState(null);

  // Notification state
  const [notificationActive, setNotificationActive] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState("");
  const [notificationError, setNotificationError] = useState(false);

  // Money format state
  const [copied, setCopied] = useState("");
  const [processedFormats, setProcessedFormats] = useState({
    withCurrency: "",
    withoutCurrency: ""
  });

  // Function to save all markets data to metafield
  const saveAllMarketsData = () => {
    // Create an array of all market data
    const allMarketsData = markets.map(market => {
      // Get the default currency from the market
      let currency = market.currencySettings?.baseCurrency?.currencyCode || "N/A";

      // Check if there's a custom currency in metafields
      if (market.metafields?.edges) {
        const currencyMetafield = market.metafields.edges.find(
          edge => edge.node.namespace === "markeet" && edge.node.key === "currency_settings"
        );

        if (currencyMetafield) {
          try {
            const metafieldData = JSON.parse(currencyMetafield.node.value);
            if (metafieldData.currency) {
              // Use the custom currency if available
              currency = metafieldData.currency;
            }
          } catch (e) {
            console.error("Error parsing metafield:", e);
          }
        }
      }

      // Get all countries for this market
      const countries = market.regions?.edges?.map(edge => edge.node.code) || [];

      // Get the market name
      const marketName = market.name || "Unnamed Market";

      // Return the market data object
      return {
        marketId: market.id,
        currency: currency,
        marketName: marketName,
        countries: countries.join(",")
      };
    });

    // Create form data with all markets
    const formData = new FormData();
    formData.append("allMarketsData", JSON.stringify(allMarketsData));
    formData.append("shopId", shopInfo.id);

    // Submit the form data
    fetcher.submit(formData, { method: "post" });

    setNotificationMessage(`All market data saved to metafield`);
    setNotificationError(false);
    setNotificationActive(true);

    // Auto-hide notification after 5 seconds
    setTimeout(() => {
      setNotificationActive(false);
    }, 5000);
  };

  // Function to save currency to metafield for a single market
  const saveCurrencyToMetafield = (marketId, selectedCurrency, countries, existingCurrencies = [], marketName = "") => {
    const formData = new FormData();
    formData.append("marketId", marketId);
    formData.append("selectedCurrency", selectedCurrency);
    formData.append("countries", JSON.stringify(countries));
    formData.append("shopId", shopInfo.id);
    formData.append("marketName", marketName);

    fetcher.submit(formData, { method: "post" });

    setNotificationMessage(`Currency ${selectedCurrency} added to market`);
    setNotificationError(false);
    setNotificationActive(true);

    // Auto-hide notification after 5 seconds
    setTimeout(() => {
      setNotificationActive(false);
    }, 5000);
  };

  // Effect to save all market data when the page loads (silently, without notification)
  useEffect(() => {
    if (markets.length > 0) {
      // Create an array of all market data
      const allMarketsData = markets.map(market => {
        // Get the default currency from the market
        let currency = market.currencySettings?.baseCurrency?.currencyCode || "N/A";

        // Check if there's a custom currency in metafields
        if (market.metafields?.edges) {
          const currencyMetafield = market.metafields.edges.find(
            edge => edge.node.namespace === "markeet" && edge.node.key === "currency_settings"
          );

          if (currencyMetafield) {
            try {
              const metafieldData = JSON.parse(currencyMetafield.node.value);
              if (metafieldData.currency) {
                // Use the custom currency if available
                currency = metafieldData.currency;
              }
            } catch (e) {
              console.error("Error parsing metafield:", e);
            }
          }
        }

        // Get all countries for this market
        const countries = market.regions?.edges?.map(edge => edge.node.code) || [];

        // Get the market name
        const marketName = market.name || "Unnamed Market";

        // Return the market data object
        return {
          marketId: market.id,
          currency: currency,
          marketName: marketName,
          countries: countries.join(",")
        };
      });

      // Create form data with all markets
      const formData = new FormData();
      formData.append("allMarketsData", JSON.stringify(allMarketsData));
      formData.append("shopId", shopInfo.id);

      // Submit the form data silently (without showing notification)
      fetcher.submit(formData, { method: "post" });
    }
  }, [markets]);

  // Process currency formats
  useEffect(() => {
    if (currencyFormats) {
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
    }
  }, [currencyFormats]);

  // Handle copy to clipboard
  const handleCopy = (text, type) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(""), 2000);
  };

  // Separate primary market from other markets
  const primaryMarket = markets.find(market => market.primary);
  const secondaryMarkets = markets.filter(market => !market.primary);

  // List of available currencies
  const availableCurrencies = [
    "USD", "EUR", "GBP", "CAD", "AUD", "JPY", "CNY", "INR", "BRL", "MXN",
    "SGD", "HKD", "CHF", "SEK", "NZD", "KRW", "ZAR", "RUB", "TRY", "AED"
  ];

  // Function to create rows for DataTable
  const createMarketRow = (market) => {
    let countries = "No countries";
    let fullCountryList = [];

    if (market.regions?.edges?.length > 0) {
      fullCountryList = market.regions.edges.map((edge) => {
        const country = edge.node;
        return `${country.name} (${country.code})`;
      });

      // Show only first 3 countries if there are more
      if (fullCountryList.length > 3) {
        const visibleCountries = fullCountryList.slice(0, 3).join(", ");

        // Create a React element with the "See more" button
        countries = (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>{visibleCountries}</span>
            <Button
              size="slim"
              onClick={() => {
                setSelectedCountries(fullCountryList);
                setModalTitle(`All Countries for ${market.name || "Unnamed Market"}`);
                setModalActive(true);
              }}
            >
              See more
            </Button>
          </div>
        );
      } else {
        countries = fullCountryList.join(", ");
      }
    }

    // Get the default currency from the market
    const defaultCurrency = market.currencySettings?.baseCurrency?.currencyCode || "N/A";

    // Variable to hold the display currency (the most recently changed one)
    let displayCurrency = defaultCurrency;

    // Create an array to hold all currencies (for saving to metafield)
    let allCurrencies = [defaultCurrency];

    // Look for custom currencies in metafields
    if (market.metafields?.edges) {
      const currencyMetafield = market.metafields.edges.find(
        edge => edge.node.namespace === "markeet" && edge.node.key === "currency_settings"
      );

      if (currencyMetafield) {
        try {
          const metafieldData = JSON.parse(currencyMetafield.node.value);

          // For display, always use the most recently selected currency if available
          if (metafieldData.currency) {
            displayCurrency = metafieldData.currency;
          }

          // Check if we have an array of currencies in the metafield
          if (metafieldData.currencies && Array.isArray(metafieldData.currencies)) {
            // Store all currencies for saving later
            allCurrencies = metafieldData.currencies;
          }
          // For backward compatibility, also check for a single currency
          else if (metafieldData.currency && !allCurrencies.includes(metafieldData.currency)) {
            allCurrencies.push(metafieldData.currency);
          }

          // Even if we don't use this here, we ensure the countries are always included in the metafield
          // This ensures all countries are saved even if currency is changed or not
        } catch (e) {
          console.error("Error parsing metafield:", e);
        }
      }
    }

    // Create a React element with the display currency and "Change" button (only for non-primary markets)
    const currencyCell = (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{
          padding: '4px 8px',
          backgroundColor: '#f4f6f8',
          borderRadius: '4px'
        }}>
          {displayCurrency}
        </span>
        {!market.primary && (
          <Button
            size="slim"
            onClick={() => {
              setSelectedMarket(market);
              setCurrencyModalActive(true);
            }}
          >
            Change Currency
          </Button>
        )}
      </div>
    );

    return [
      market.name || "Unnamed Market",
      countries,
      currencyCell,
      market.enabled ? "Enabled" : "Disabled"
    ];
  };

  // Create rows for primary and secondary markets
  const primaryMarketRow = primaryMarket ? createMarketRow(primaryMarket) : null;
  const secondaryMarketRows = secondaryMarkets.map(market => createMarketRow(market));

  return (
    <Page
      title="Markets"
      primaryAction={{
        content: "Save All Markets Data",
        onAction: saveAllMarketsData
      }}
    >
      {/* Countries Modal */}
      <Modal
        open={modalActive}
        onClose={() => setModalActive(false)}
        title={modalTitle}
        primaryAction={{
          content: "Close",
          onAction: () => setModalActive(false),
        }}
      >
        <Modal.Section>
          <BlockStack gap="400">
            <Text variant="bodyMd">This market includes the following {selectedCountries.length} countries:</Text>
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {selectedCountries.map((country, index) => (
                <Text key={index} variant="bodyMd" as="p" style={{ margin: '8px 0' }}>• {country}</Text>
              ))}
            </div>
          </BlockStack>
        </Modal.Section>
      </Modal>

      {/* Currency Change Modal */}
      <Modal
        open={currencyModalActive}
        onClose={() => setCurrencyModalActive(false)}
        title={`Change Currency for ${selectedMarket?.name || "Market"}`}
        primaryAction={{
          content: "Close",
          onAction: () => setCurrencyModalActive(false),
        }}
      >
        <Modal.Section>
          <BlockStack gap="400">
            <Text variant="bodyMd">Select a new base currency for this market:</Text>
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {availableCurrencies.map((currency, index) => (
                <div key={index} style={{
                  padding: '12px',
                  borderBottom: index < availableCurrencies.length - 1 ? '1px solid #e1e3e5' : 'none',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <Text variant="bodyMd">{currency}</Text>
                  <Button
                    size="slim"
                    onClick={() => {
                      // Get all countries from the selected market
                      const countries = selectedMarket.regions.edges.map(edge => ({
                        id: edge.node.id,
                        name: edge.node.name,
                        code: edge.node.code
                      }));

                      // Get the market name
                      const marketName = selectedMarket.name || "Unnamed Market";

                      // Save to metafield with only essential data: currency, countries, and market name
                      saveCurrencyToMetafield(selectedMarket.id, currency, countries, [], marketName);
                      setCurrencyModalActive(false);
                    }}
                  >
                    Select
                  </Button>
                </div>
              ))}
            </div>
          </BlockStack>
        </Modal.Section>
      </Modal>

      <Layout>
        {notificationActive && (
          <Layout.Section>
            <Banner
              title={notificationError ? "Error" : "Success"}
              status={notificationError ? "critical" : "success"}
              onDismiss={() => setNotificationActive(false)}
            >
              <p>{notificationMessage}</p>
            </Banner>
          </Layout.Section>
        )}

        {(errors || error) && (
          <Layout.Section>
            <Banner title="Error fetching markets" status="critical">
              <p>{error || JSON.stringify(errors)}</p>
              <p>Ensure your app has permission to access markets.</p>
            </Banner>
          </Layout.Section>
        )}

        {markets.length === 0 ? (
          <Layout.Section>
            <Card>
              <BlockStack gap="500">
                <Text as="h2" variant="headingMd">Markets from your Shopify Store</Text>
                <Box padding="400">
                  <Text as="p" variant="bodyMd">
                    No markets found in your Shopify store.
                    <br /><br />
                    To create a market, go to Shopify Admin → Settings → Markets.
                  </Text>
                </Box>
              </BlockStack>
            </Card>
          </Layout.Section>
        ) : (
          <>
            {primaryMarket && (
              <Layout.Section>
                <Card>
                  <BlockStack gap="300" padding="400">
                    <Text as="h2" variant="headingMd">Primary Market</Text>
                    <Text as="p" variant="bodyMd">
                      United States is your primary market with currency USD.
                    </Text>
                    <Text as="p" variant="bodyMd" fontWeight="bold" color="critical">
                      Note: The primary market's currency cannot be changed.
                    </Text>
                  </BlockStack>
                </Card>
              </Layout.Section>
            )}

            {secondaryMarkets.length > 0 && (
              <Layout.Section>
                <Card>
                  <BlockStack gap="500">
                    <Text as="h2" variant="headingMd">Secondary Markets (Customizable)</Text>
                    <DataTable
                      columnContentTypes={["text", "text", "text", "text"]}
                      headings={["Market Name", "Countries", "Currency", "Status"]}
                      rows={secondaryMarketRows}
                    />
                  </BlockStack>
                </Card>
              </Layout.Section>
            )}
          </>
        )}

        {/* Money Format Section */}
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
                  <Link url="https://admin.shopify.com/store/settings/general#currency-display" target="_blank">
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
                          <Text as="span" variant="bodyLg">{processedFormats.withCurrency || '<span class="currency-changer">$${{amount}}USD</span>'}</Text>
                          <Button
                            onClick={() => handleCopy(processedFormats.withCurrency || '<span class="currency-changer">$${{amount}}USD</span>', "with")}
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
                          <Text as="span" variant="bodyLg">{processedFormats.withoutCurrency || '<span class="currency-changer">{{amount}}</span>'}</Text>
                          <Button
                            onClick={() => handleCopy(processedFormats.withoutCurrency || '<span class="currency-changer">{{amount}}</span>', "without")}
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
      </Layout>
    </Page>
  );
}
