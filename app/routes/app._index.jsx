import { useEffect, useState } from "react";
import { Page, Layout, Card, Text, Button, Spinner } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { CurrencySelector } from "../components/CurrencySelector";
import { PricingPage } from "../components/PricingPage";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return null;
};

export default function Index() {
  const [isFirstVisit, setIsFirstVisit] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if this is the first visit
    fetch("/api/first-visit")
      .then((response) => response.json())
      .then((data) => {
        setIsFirstVisit(data.isFirstVisit);
        setLoading(false);
      })
      .catch((error) => {
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

  return isFirstVisit ? <PricingPage /> : <CurrencySelector />;
}
