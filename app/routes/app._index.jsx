import { Page, Layout, Card, Text, BlockStack, Button, Link, Box, InlineStack } from "@shopify/polaris";
import { CurrencySelector } from "../components/CurrencySelector";
import { authenticate } from "../shopify.server";
import { useState } from "react";
import { useLoaderData } from "@remix-run/react";
import { json, redirect } from "@remix-run/node";
import { useEffect } from "react";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  
  // Redirect to the pricing page
  return redirect("/app/pricing");
};

export default function Index() {
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

  return null;
}
