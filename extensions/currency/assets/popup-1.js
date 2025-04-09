// Localization form functionality
class LocalizationForm extends HTMLElement {
  constructor() {
    super();
    this.elements = {
      input: this.querySelector('input[name="language_code"], input[name="country_code"]'),
      button: this.querySelector('button'),
      panel: this.querySelector('ul'),
    };

    // Add event listeners only if elements exist
    if (this.elements.button) {
      this.elements.button.addEventListener('click', this.openSelector.bind(this));
      this.elements.button.addEventListener('focusout', this.closeSelector.bind(this));
    }

    this.addEventListener('keyup', this.onContainerKeyUp.bind(this));

    // Add click listeners to all anchor tags
    const anchors = this.querySelectorAll('a');
    if (anchors && anchors.length > 0) {
      anchors.forEach(item => item.addEventListener('click', this.onItemClick.bind(this)));
    }
  }

  hidePanel() {
    if (this.elements.button) {
      this.elements.button.setAttribute('aria-expanded', 'false');
    }
    if (this.elements.panel) {
      this.elements.panel.setAttribute('hidden', true);
    }
  }

  onContainerKeyUp(event) {
    if (event.code.toUpperCase() !== 'ESCAPE') return;
    this.hidePanel();
    if (this.elements.button) {
      this.elements.button.focus();
    }
  }

  onItemClick(event) {
    event.preventDefault();
    const form = this.querySelector('form');
    if (this.elements.input && event.currentTarget && event.currentTarget.dataset) {
      const selectedValue = event.currentTarget.dataset.value;
      this.elements.input.value = selectedValue;
      
      // Check if this is a country selection
      if (this.elements.input.name === 'country_code') {
        // Get the market data from the hidden span
        const marketDataSpan = document.querySelector('.vento-curriency-metafiled-span');
        if (marketDataSpan) {
          try {
            const marketData = JSON.parse(marketDataSpan.textContent);
            
            // Find the market that contains this country
            const matchingMarket = marketData.find(market => {
              const countries = market.countries.split(',');
              return countries.includes(selectedValue);
            });
            
            // If a matching market is found, save and log its currency
            if (matchingMarket) {
              // Save market info to localStorage
              localStorage.setItem('selectedMarketName', matchingMarket.marketName);
              localStorage.setItem('selectedMarketCurrency', matchingMarket.currency);
              localStorage.setItem('selectedCountry', selectedValue);
              
              // Also save to cookies for better persistence
              setCookie('ventoSelectedCurrency', matchingMarket.currency, 60 * 24 * 7); // 1 week
              setCookie('ventoSelectedMarket', matchingMarket.marketName, 60 * 24 * 7); // 1 week
              setCookie('ventoSelectedCountry', selectedValue, 60 * 24 * 7); // 1 week
              
              console.log('Selected country belongs to market:', matchingMarket.marketName);
              console.log('Market currency:', matchingMarket.currency);
              
              // Fetch exchange rates and update prices
              const url = `https://api.exchangerate-api.com/v4/latest/USD`;
              fetch(url)
                .then(response => response.json())
                .then(data => {
                  console.log('Exchange rate data received:', data.rates[matchingMarket.currency]);
                  updatePrices(matchingMarket.currency, data.rates);
                })
                .catch(error => console.error('Error fetching exchange rates:', error));
            } else {
              localStorage.setItem('selectedMarketName', 'none');
              localStorage.setItem('selectedMarketCurrency', 'none');
              localStorage.setItem('selectedCountry', selectedValue);
              
              // Also clear cookies
              setCookie('ventoSelectedCurrency', 'none', 60 * 24 * 7); // 1 week
              setCookie('ventoSelectedMarket', 'none', 60 * 24 * 7); // 1 week
              setCookie('ventoSelectedCountry', selectedValue, 60 * 24 * 7); // 1 week
              
              console.log('Selected country does not belong to any defined market');
            }
          } catch (e) {
            console.error('Error parsing market data:', e);
          }
        }
      }
      
      // Set a flag using a cookie to indicate we're coming from a language/country selection
      // This will be used to keep the popup open after redirect
      setCookie('ventoKeepPopupOpen', 'true', 5); // Short expiration (5 minutes) as we only need it for the redirect
      console.log('Setting cookie flag to keep popup open after redirect');
      
      // Verify the cookie was set correctly
      const cookieCheck = getCookie('ventoKeepPopupOpen');
      console.log('ventoKeepPopupOpen cookie value before redirect:', cookieCheck);
      
      if (form) form.submit();
    }
  }

  openSelector() {
    if (this.elements.button) {
      this.elements.button.focus();
    }
    if (this.elements.panel) {
      this.elements.panel.toggleAttribute('hidden');
      if (this.elements.button) {
        this.elements.button.setAttribute('aria-expanded',
          (this.elements.button.getAttribute('aria-expanded') === 'false').toString());
      }
    }
  }

  closeSelector(event) {
    const shouldClose = event.relatedTarget && event.relatedTarget.nodeName === 'BUTTON';
    if (event.relatedTarget === null || shouldClose) {
      this.hidePanel();
    }
  }
}

// Define the custom element with error handling
try {
  customElements.define('vento-localization-form', LocalizationForm);
} catch (e) {
  console.warn('Error registering vento-localization-form:', e);
}

// Also define the original element name for backward compatibility
try {
  if (!customElements.get('localization-form')) {
    customElements.define('localization-form', LocalizationForm);
  }
} catch (e) {
  console.warn('Error registering localization-form:', e);
}

// Cookie utility functions (moved to global scope)
function setCookie(name, value, minutes) {
  let expires = "";
  if (minutes) {
    const date = new Date();
    date.setTime(date.getTime() + (minutes * 60 * 1000));
    expires = "; expires=" + date.toUTCString();
  }
  // Add secure and SameSite attributes for better cookie handling
  document.cookie = name + "=" + (value || "") + expires + "; path=/; SameSite=Lax";
  console.log('Cookie set:', name, '=', value, 'expires in', minutes, 'minutes');
}

function getCookie(name) {
  const nameEQ = name + "=";
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
  }
  return null;
}

// Popup functionality
document.addEventListener('DOMContentLoaded', function() {
  try {
    // Check for currency in cookies first, then fallback to localStorage
    const currencyCookie = getCookie('ventoSelectedCurrency');
    
    // Get saved market data from localStorage
    const savedMarketName = localStorage.getItem('selectedMarketName');
    const savedMarketCurrency = currencyCookie || localStorage.getItem('selectedMarketCurrency');
    const savedCountry = localStorage.getItem('selectedCountry');
    
    // If we have currency in cookie but not in localStorage, update localStorage
    if (currencyCookie && (!localStorage.getItem('selectedMarketCurrency') || 
        localStorage.getItem('selectedMarketCurrency') !== currencyCookie)) {
      localStorage.setItem('selectedMarketCurrency', currencyCookie);
    }
    
    if (savedMarketName && savedMarketCurrency && savedCountry) {
      if (savedMarketName !== 'none') {
        console.log('Saved country selection:', savedCountry);
        console.log('Saved market:', savedMarketName);
        console.log('Saved currency:', savedMarketCurrency);
        
        // Also save to cookie for redundancy
        setCookie('ventoSelectedCurrency', savedMarketCurrency, 60 * 24 * 7); // 1 week
      } else {
        console.log('Saved country selection:', savedCountry);
        console.log('This country does not belong to any defined market');
      }
    }
    
    // Process product prices
    try {
      var product_price = document.querySelectorAll('.currency-changer');
      console.log('product_price',product_price)
      console.log('Product price elements found:', product_price.length);
      
      // Try to get original prices from cookie
      var originalPrices = {};
      var priceDataCookie = getCookie('ventoCurrencyOriginalPrices');
      
      if (priceDataCookie) {
        try {
          originalPrices = JSON.parse(priceDataCookie);
          console.log('Retrieved original prices from cookie');
        } catch (e) {
          console.error('Error parsing original prices from cookie:', e);
        }
      }
      
      // Process each price element
      product_price.forEach(function(span, index) {
        const elementId = span.id || `price-element-${index}`;
        
        // If we don't have an ID, set one for reference
        if (!span.id) {
          span.id = elementId;
        }
        
        // Get original price from cookie or from element
        if (originalPrices[elementId]) {
          span.setAttribute('data-original-price', originalPrices[elementId]);
          console.log(`Using cached original price for ${elementId}:`, originalPrices[elementId]);
        } else {
          if (!span.hasAttribute('data-original-price')) {
            let cleanedText = span.textContent.trim().replace(/[^0-9.]/g, "");
            span.setAttribute('data-original-price', cleanedText);
            originalPrices[elementId] = cleanedText;
          }
        }
        
        let originalPrice = parseFloat(span.getAttribute('data-original-price'));
        console.log('Original price:', originalPrice);
      });
      
      // Save original prices to cookie
      setCookie('ventoCurrencyOriginalPrices', JSON.stringify(originalPrices), 60 * 24 * 7); // 1 week
      
      // If we have a saved currency, fetch exchange rates and update prices
      if (savedMarketCurrency && savedMarketCurrency !== 'none') {
        console.log('Using saved market currency:', savedMarketCurrency);
        
        const url = `https://api.exchangerate-api.com/v4/latest/USD`;
        fetch(url)
            .then(response => response.json())
            .then(data => {
                console.log('Exchange rate data received:', data.rates[savedMarketCurrency]);
                updatePrices(savedMarketCurrency, data.rates);
            })
            .catch(error => console.error('Error fetching exchange rates:', error));
      }
    } catch (e) {
      console.error('Error processing product prices:', e);
    }
    
    // Try to get elements with vento prefix first
    let popup = document.getElementById('vento-my-shopify-popup');
    let closeButton = document.getElementById('vento-popup-close-btn');
    let closeXButton = document.getElementById('vento-popup-close-x');
    let overlay = document.getElementById('vento-popup-overlay');

    // Fallback to original IDs if vento prefixed elements not found
    if (!popup) popup = document.getElementById('my-shopify-popup');
    if (!closeButton) closeButton = document.getElementById('popup-close-btn');
    if (!closeXButton) closeXButton = document.getElementById('popup-close-x');
    if (!overlay) overlay = document.getElementById('popup-overlay');

    // Only proceed if we found the popup element
    if (popup) {
      // Function to show popup
      function showPopup() {
        console.log('showPopup function called - setting display to flex');
        popup.style.display = 'flex';
        // Force a reflow to ensure the display change takes effect
        void popup.offsetWidth;
      }

      // Function to hide popup and set cookie
      function hidePopup() {
        popup.style.display = 'none';

        // Set cookie for 7 days instead of just 60 minutes
        try {
          setCookie('ventoPopupClosed', 'true', 60 * 24 * 7); // 7 days
          console.log('Popup cookie set for 7 days');
          // Verify cookie was set
          const cookieCheck = getCookie('ventoPopupClosed');
          console.log('Cookie check after setting:', cookieCheck);
        } catch (e) {
          console.warn('Could not set cookie:', e);
        }

        // Also store in session as a fallback
        try {
          sessionStorage.setItem('localizationPopupShown', 'true');
          console.log('Session storage set for popup');
        } catch (e) {
          console.warn('Could not save popup state to sessionStorage:', e);
        }
      }

      // Check if popup should be shown
      let popupClosed = getCookie('ventoPopupClosed');
      let keepPopupOpen = getCookie('ventoKeepPopupOpen');
      console.log('Popup closed cookie value on page load:', popupClosed);
      console.log('Keep popup open cookie value:', keepPopupOpen);
      
      // If we're coming from a language/country selection, keep the popup open
      if (keepPopupOpen === 'true') {
        console.log('Showing popup because we came from language/country selection');
        // Clear the flag cookie so it only applies to this page load
        setCookie('ventoKeepPopupOpen', '', -1); // Expire immediately
        
        // Add a small delay to ensure the DOM is fully loaded
        setTimeout(function() {
          console.log('Delayed popup display after redirect');
          showPopup();
        }, 300);
      }
      // Otherwise, check the cookie to determine if popup should be shown
      else if (popupClosed === 'true') {
        console.log('Popup will not be shown because Continue Shopping cookie is set');
        popup.style.display = 'none';
      } else {
        console.log('Showing popup - no Continue Shopping cookie found');
        showPopup();
      }

      // Add event listeners for closing
      if (closeButton) {
        closeButton.addEventListener('click', function() {
          // Custom handling for Continue Shopping button
          console.log('Continue Shopping button clicked');
          
          // Hide the popup
          popup.style.display = 'none';
          
          // Set a dedicated cookie for the Continue Shopping button with 7-day expiration
          const date = new Date();
          date.setTime(date.getTime() + (7 * 24 * 60 * 60 * 1000)); // 7 days in milliseconds
          const expires = "; expires=" + date.toUTCString();
          document.cookie = "ventoPopupClosed=true" + expires + "; path=/; SameSite=Lax";
          
          console.log('Popup closed by Continue Shopping button. Cookie set for 7 days.');
          // Verify the cookie was set
          console.log('Cookie value after setting:', getCookie('ventoPopupClosed'));
        });
      }

      if (closeXButton) {
        closeXButton.addEventListener('click', hidePopup);
      }

      if (overlay) {
        overlay.addEventListener('click', hidePopup);
      }
    } else {
      console.warn('Popup element not found');
    }
  } catch (e) {
    console.error('Error initializing popup:', e);
  }
});

// Add a window load event to ensure currency conversion happens on page reload
window.addEventListener('load', function() {
  console.log('Window loaded, ensuring price elements are properly tagged');
  
  // Check if we need to show the popup (double-check)
  const keepPopupOpen = getCookie('ventoKeepPopupOpen');
  if (keepPopupOpen === 'true') {
    console.log('Window load event: Detected keepPopupOpen flag');
    const popup = document.getElementById('vento-my-shopify-popup') || document.getElementById('my-shopify-popup');
    
    if (popup) {
      console.log('Window load event: Showing popup');
      popup.style.display = 'flex';
      
      // Clear the flag
      setCookie('ventoKeepPopupOpen', '', -1);
      
      // Re-attach event listeners to the buttons
      const closeButton = document.getElementById('vento-popup-close-btn') || document.getElementById('popup-close-btn');
      const closeXButton = document.getElementById('vento-popup-close-x') || document.getElementById('popup-close-x');
      const overlay = document.getElementById('vento-popup-overlay') || document.getElementById('popup-overlay');
      
      // Function to hide popup
      function hidePopupAfterRedirect() {
        console.log('Hiding popup after redirect');
        popup.style.display = 'none';
        
        // Set cookie for 7 days
        setCookie('ventoPopupClosed', 'true', 60 * 24 * 7); // 7 days
        console.log('Popup closed cookie set after redirect');
      }
      
      // Add event listeners for closing
      if (closeButton) {
        console.log('Adding event listener to close button after redirect');
        closeButton.addEventListener('click', hidePopupAfterRedirect);
      }
      
      if (closeXButton) {
        closeXButton.addEventListener('click', hidePopupAfterRedirect);
      }
      
      if (overlay) {
        overlay.addEventListener('click', hidePopupAfterRedirect);
      }
    }
  }
  
  // Ensure all price elements have the currency-changer class
  const elementsFound = ensurePriceElements();
  console.log('Found and tagged price elements on page load:', elementsFound);
  
  // Check for currency in cookies first, then fallback to localStorage
  const currencyCookie = getCookie('ventoSelectedCurrency');
  const savedMarketCurrency = currencyCookie || localStorage.getItem('selectedMarketCurrency');
  
  // If we have currency in cookie but not in localStorage, update localStorage
  if (currencyCookie && (!localStorage.getItem('selectedMarketCurrency') || 
      localStorage.getItem('selectedMarketCurrency') !== currencyCookie)) {
    localStorage.setItem('selectedMarketCurrency', currencyCookie);
  }
  
  if (savedMarketCurrency && savedMarketCurrency !== 'none') {
    console.log('Window load: Applying saved currency:', savedMarketCurrency);
    
    // Fetch exchange rates and update prices
    const url = `https://api.exchangerate-api.com/v4/latest/USD`;
    fetch(url)
      .then(response => response.json())
      .then(data => {
        console.log('Window load: Exchange rate data received:', data.rates[savedMarketCurrency]);
        
        // Try updating prices immediately
        updatePrices(savedMarketCurrency, data.rates);
        
        // And also try again after a short delay to catch any lazy-loaded elements
        setTimeout(() => {
          ensurePriceElements();
          updatePrices(savedMarketCurrency, data.rates);
        }, 1000);
      })
      .catch(error => console.error('Error fetching exchange rates:', error));
  }
});

// Function to ensure price elements have the currency-changer class
function ensurePriceElements() {
    // Find all price elements that might need the currency-changer class
    const potentialPriceElements = document.querySelectorAll('.price:not(.currency-changer), .product-price:not(.currency-changer), [data-price]:not(.currency-changer), .money:not(.currency-changer)');
    
    console.log('Found potential price elements to convert:', potentialPriceElements.length);
    
    // Add the currency-changer class to these elements
    potentialPriceElements.forEach((element, index) => {
        element.classList.add('currency-changer');
        
        // If the element doesn't have an ID, give it one
        if (!element.id) {
            element.id = `price-element-auto-${index}`;
        }
        
        console.log('Added currency-changer class to:', element.id || 'unnamed element');
    });
    
    return document.querySelectorAll('.currency-changer').length;
}

// Function to update prices based on selected currency and exchange rates
function updatePrices(selectedCurrency, exchangeRates) {
    

    console.log('updatePrices called with currency:', selectedCurrency);
    console.log('Exchange rates:', exchangeRates);
    
    // Make sure currencyElements exists for the selected currency
    if (!currencyElements[selectedCurrency]) {
        console.error('Currency format not found for:', selectedCurrency);
        return;
    }
    
    // Find all elements with the currency-changer class
    var product_price = document.querySelectorAll('.currency-changer');
    console.log('Found price elements:', product_price.length);
    
    // If no elements found, try to add the class to potential price elements
    if (product_price.length === 0) {
        console.log('No price elements found, trying to find and convert potential price elements');
        const elementsFound = ensurePriceElements();
        
        if (elementsFound > 0) {
            console.log('Found and converted price elements:', elementsFound);
            product_price = document.querySelectorAll('.currency-changer');
        } else {
            console.log('Still no price elements found, will retry in 500ms');
            setTimeout(function() {
                updatePrices(selectedCurrency, exchangeRates);
            }, 500);
            return;
        }
    }
    
    var originalPrices = {};
    var priceDataCookie = getCookie('ventoCurrencyOriginalPrices');
    
    // Try to get original prices from cookie first
    if (priceDataCookie) {
        try {
            originalPrices = JSON.parse(priceDataCookie);
            console.log('Retrieved original prices from cookie:', originalPrices);
        } catch (e) {
            console.error('Error parsing original prices from cookie:', e);
        }
    }

    // Process each price element
    product_price.forEach(function (span, index) {
        const elementId = span.id || `price-element-${index}`;
        console.log('Processing element:', elementId);
        
        // If we don't have an ID, set one for reference
        if (!span.id) {
            span.id = elementId;
        }
        
        // Get original price from cookie or from element
        let originalPrice;
        if (originalPrices[elementId]) {
            originalPrice = parseFloat(originalPrices[elementId]);
            console.log('Using cached price:', originalPrice);
        } else {
            if (!span.hasAttribute('data-original-price')) {
                let cleanedText = span.textContent.trim().replace(/[^0-9.]/g, "");
                span.setAttribute('data-original-price', cleanedText);
                originalPrices[elementId] = cleanedText;
                console.log('Extracted price from text:', cleanedText);
            }
            originalPrice = parseFloat(span.getAttribute('data-original-price'));
            originalPrices[elementId] = originalPrice;
        }
        
        if (isNaN(originalPrice)) {
            console.error('Invalid original price for element:', elementId);
            return;
        }
        
        // Convert and display price
        let convertedPrice = originalPrice * exchangeRates[selectedCurrency];
        console.log('Original price:', originalPrice, 'Converted price:', convertedPrice);
        
        try {
            if (currencyElements[selectedCurrency].money_with_currency_format.includes("{{amount_with_comma_separator}}")) {
                let amountWithCommaSeparator = convertedPrice.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                span.textContent = `${currencyElements[selectedCurrency].currency_symbol} ${amountWithCommaSeparator} ${selectedCurrency}`;
            } else if (currencyElements[selectedCurrency].money_with_currency_format.includes("{{amount_no_decimals_with_comma_separator}}")) {
                let amountNoDecimals = Math.round(convertedPrice);
                let amountNoDecimalsWithCommaSeparator = amountNoDecimals.toLocaleString('de-DE');
                span.textContent = `${currencyElements[selectedCurrency].currency_symbol} ${amountNoDecimalsWithCommaSeparator} ${selectedCurrency}`;
            } else if (currencyElements[selectedCurrency].money_with_currency_format.includes("{{amount_no_decimals}}")) {
                let amountNoDecimals = Math.round(convertedPrice);
                span.textContent = `${currencyElements[selectedCurrency].currency_symbol} ${amountNoDecimals} ${selectedCurrency}`;
            } else {
                span.textContent = `${currencyElements[selectedCurrency].currency_symbol} ${Number(`${convertedPrice}`).toFixed(2)} ${selectedCurrency}`;
            }
            console.log('Updated text content to:', span.textContent);
        } catch (e) {
            console.error('Error formatting price:', e);
        }
    });
    
    // Save original prices to cookie
    setCookie('ventoCurrencyOriginalPrices', JSON.stringify(originalPrices), 60 * 24 * 7); // 1 week
    
    // Also save the current currency to cookie
    setCookie('ventoSelectedCurrency', selectedCurrency, 60 * 24 * 7); // 1 week
    
    console.log('Price update complete for currency:', selectedCurrency);
}


const currencyElements = {

    AED: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} AED",
        currency_symbol: "Dhs."
    },
    AFN: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} AFN",
        currency_symbol: "Af"
    },
    ALL: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} ALL",
        currency_symbol: "Lek"
    },
    AMD: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} AMD",
        currency_symbol: "֏"
    },
    ANG: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}}",
        currency_symbol: "ƒ"
    },
    AOA: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} AOA",
        currency_symbol: "Kz"
    },
    ARS: {
        money_format: "{{amount_with_comma_separator}}",
        money_with_currency_format: "{{amount_with_comma_separator}} ARS",
        currency_symbol: "$"
    },
    AUD: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} AUD",
        currency_symbol: "$"
    },
    AWG: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} AWG",
        currency_symbol: "Afl"
    },
    AZN: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} AZN",
        currency_symbol: "₼"
    },
    BAM: {
        money_format: "{{amount_with_comma_separator}}",
        money_with_currency_format: "{{amount_with_comma_separator}} BAM",
        currency_symbol: "KM"
    },
    BBD: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} Bds",
        currency_symbol: "$"
    },
    BDT: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} BDT",
        currency_symbol: "Tk"
    },
    BGN: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} BGN",
        currency_symbol: "лв"
    },
    BHD: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} BHD",
        currency_symbol: "BD"
    },
    BIF: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} BIF",
        currency_symbol: ""
    },
    BMD: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} BMD",
        currency_symbol: "$"
    },
    BND: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} BND",
        currency_symbol: "$"
    },
    BOB: {
        money_format: "{{amount_with_comma_separator}}",
        money_with_currency_format: "{{amount_with_comma_separator}} BOB",
        currency_symbol: "Bs"
    },
    BRL: {
        money_format: "{{amount_with_comma_separator}}",
        money_with_currency_format: "{{amount_with_comma_separator}} BRL",
        currency_symbol: "R$"
    },
    BSD: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} BSD",
        currency_symbol: "BS$"
    },
    BTC: {
        money_format: "{{amount_no_decimals}}",
        money_with_currency_format: "{{amount_no_decimals}} BTC",
        currency_symbol: "₿"
    },
    BTN: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} BTN",
        currency_symbol: "Nu"
    },
    BWP: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} BWP",
        currency_symbol: "P"
    },
    BYN: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} BYN",
        currency_symbol: "Br"
    },
    BZD: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} BZD",
        currency_symbol: "BZ$"
    },
    CAD: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} CAD",
        currency_symbol: "$"
    },
    CDF: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} CDF",
        currency_symbol: ""
    },
    CHF: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}}",
        currency_symbol: "CHF"
    },
    CLP: {
        money_format: "{{amount_no_decimals}}",
        money_with_currency_format: "{{amount_no_decimals}} CLP",
        currency_symbol: "$"
    },
    CNY: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} CNY",
        currency_symbol: "¥"
    },
    COP: {
        money_format: "{{amount_with_comma_separator}}",
        money_with_currency_format: "{{amount_with_comma_separator}} COP",
        currency_symbol: "$"
    },
    CRC: {
        money_format: "{{amount_with_comma_separator}}",
        money_with_currency_format: "{{amount_with_comma_separator}} CRC",
        currency_symbol: "₡"
    },
    CUC: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} CUC",
        currency_symbol: ""
    },
    CUP: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} CUP",
        currency_symbol: ""
    },
    CVE: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} CVE",
        currency_symbol: "$"
    },
    CZK: {
        money_format: "{{amount_with_comma_separator}}",
        money_with_currency_format: "{{amount_with_comma_separator}} CZK",
        currency_symbol: "Kč"
    },
    DJF: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} DJF",
        currency_symbol: ""
    },
    DKK: {
        money_format: "{{amount_with_comma_separator}}",
        money_with_currency_format: "{{amount_with_comma_separator}} DKK",
        currency_symbol: "kr"
    },
    DOP: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} DOP",
        currency_symbol: "RD$"
    },
    DZD: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} DZD",
        currency_symbol: "DA"
    },
    EEK: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} EEK",
        currency_symbol: ""
    },
    EGP: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} EGP",
        currency_symbol: "LE"
    },
    ERN: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} ERN",
        currency_symbol: ""
    },
    ETB: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} ETB",
        currency_symbol: "Br"
    },
    EUR: {
        money_format: "{{amount_with_comma_separator}}",
        money_with_currency_format: "{{amount_with_comma_separator}} EUR",
        currency_symbol: "€"
    },
    FJD: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} FJD",
        currency_symbol: "$"
    },
    FKP: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} FKP",
        currency_symbol: "£"
    },
    GBP: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} GBP",
        currency_symbol: "£"
    },
    GEL: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} GEL",
        currency_symbol: "₾"
    },
    GGP: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} GGP",
        currency_symbol: ""
    },
    GHS: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} GHS",
        currency_symbol: "GH₵"
    },
    GIP: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} GIP",
        currency_symbol: "£"
    },
    GMD: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} GMD",
        currency_symbol: "D"
    },
    GNF: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} GNF",
        currency_symbol: ""
    },
    GTQ: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} GTQ",
        currency_symbol: "Q"
    },
    GYD: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} GYD",
        currency_symbol: "$"
    },
    HKD: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} HKD",
        currency_symbol: "HK$"
    },
    HNL: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} HNL",
        currency_symbol: "L"
    },
    HRK: {
        money_format: "{{amount_with_comma_separator}}",
        money_with_currency_format: "{{amount_with_comma_separator}} HRK",
        currency_symbol: "kn"
    },
    HTG: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} HTG",
        currency_symbol: "G"
    },
    HUF: {
        money_format: "{{amount_no_decimals_with_comma_separator}}",
        money_with_currency_format: "{{amount_no_decimals_with_comma_separator}} HUF",
        currency_symbol: "Ft"
    },
    IDR: {
        money_format: "{{amount_with_comma_separator}}",
        money_with_currency_format: "{{amount_with_comma_separator}} IDR",
        currency_symbol: "Rp"
    },
    ILS: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} ILS",
        currency_symbol: "₪"
    },
    IMP: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} IMP",
        currency_symbol: ""
    },
    INR: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} INR",
        currency_symbol: "₹"
    },
    IQD: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} IQD",
        currency_symbol: "ع.د"
    },
    IRR: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} IRR",
        currency_symbol: "﷼"
    },
    ISK: {
        money_format: "{{amount_no_decimals}}",
        money_with_currency_format: "{{amount_no_decimals}} ISK",
        currency_symbol: "kr"
    },
    JEP: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} JEP",
        currency_symbol: "£"
    },
    JMD: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} JMD",
        currency_symbol: "$"
    },
    JOD: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} JOD",
        currency_symbol: "JD"
    },
    JPY: {
        money_format: "{{amount_no_decimals}}",
        money_with_currency_format: "{{amount_no_decimals}} JPY",
        currency_symbol: "¥"
    },
    KES: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} KES",
        currency_symbol: "KSh"
    },
    KGS: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} KGS",
        currency_symbol: "лв"
    },
    KHR: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} KHR",
        currency_symbol: "KHR"
    },
    KMF: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} KMF",
        currency_symbol: "CF"
    },
    KPW: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} KPW",
        currency_symbol: "₩"
    },
    KRW: {
        money_format: "{{amount_no_decimals}}",
        money_with_currency_format: "{{amount_no_decimals}} KRW",
        currency_symbol: "₩"
    },
    KWD: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} KWD",
        currency_symbol: "KD"
    },
    KYD: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} KYD",
        currency_symbol: "$"
    },
    KZT: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} KZT",
        currency_symbol: "₸"
    },
    LAK: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} LAK",
        currency_symbol: "₭"
    },
    LBP: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} LBP",
        currency_symbol: "L.L."
    },
    LKR: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} LKR",
        currency_symbol: "Rs"
    },
    LRD: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} LRD",
        currency_symbol: "$"
    },
    LSL: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} LSL",
        currency_symbol: "L"
    },
    LTL: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} LTL",
        currency_symbol: "Lt"
    },
    LVL: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} LVL",
        currency_symbol: "Ls"
    },
    LYD: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} LYD",
        currency_symbol: "ل.د"
    },
    MAD: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} MAD",
        currency_symbol: "dh"
    },
    MDL: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} MDL",
        currency_symbol: "MDL"
    },
    MGA: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} MGA",
        currency_symbol: "Ar"
    },
    MKD: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} MKD",
        currency_symbol: "ден"
    },
    MMK: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} MMK",
        currency_symbol: "K"
    },
    MNT: {
        money_format: "{{amount_no_decimals}}",
        money_with_currency_format: "{{amount_no_decimals}} MNT",
        currency_symbol: "₮"
    },
    MOP: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} MOP",
        currency_symbol: "MOP$"
    },
    MRO: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} MRO",
        currency_symbol: "UM"
    },
    MUR: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} MUR",
        currency_symbol: "Rs"
    },
    MVR: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} MVR",
        currency_symbol: "Rf"
    },
    MWK: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} MWK",
        currency_symbol: "MK"
    },
    MXN: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} MXN",
        currency_symbol: "$"
    },
    MYR: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} MYR",
        currency_symbol: "RM"
    },
    MZN: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} MZN",
        currency_symbol: "Mt"
    },
    NAD: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} NAD",
        currency_symbol: "N$"
    },
    NGN: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} NGN",
        currency_symbol: "₦"
    },
    NIO: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} NIO",
        currency_symbol: "C$"
    },
    NOK: {
        money_format: "{{amount_with_comma_separator}}",
        money_with_currency_format: "{{amount_with_comma_separator}} NOK",
        currency_symbol: "kr"
    },
    NPR: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} NPR",
        currency_symbol: "Rs"
    },
    NZD: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} NZD",
        currency_symbol: "$"
    },
    OMR: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} OMR",
        currency_symbol: "OMR"
    },
    PAB: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} PAB",
        currency_symbol: "B/."
    },
    PEN: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} PEN",
        currency_symbol: "S/."
    },
    PGK: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} PGK",
        currency_symbol: "K"
    },
    PHP: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} PHP",
        currency_symbol: "₱"
    },
    PKR: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} PKR",
        currency_symbol: "Rs."
    },
    PLN: {
        money_format: "{{amount_with_comma_separator}}",
        money_with_currency_format: "{{amount_with_comma_separator}} PLN",
        currency_symbol: "zl"
    },
    PYG: {
        money_format: "{{amount_no_decimals_with_comma_separator}}",
        money_with_currency_format: "{{amount_no_decimals_with_comma_separator}} PYG",
        currency_symbol: "Gs."
    },
    QAR: {
        money_format: "{{amount_with_comma_separator}}",
        money_with_currency_format: "{{amount_with_comma_separator}} QAR",
        currency_symbol: "QAR"
    },
    RON: {
        money_format: "{{amount_with_comma_separator}}",
        money_with_currency_format: "{{amount_with_comma_separator}} RON",
        currency_symbol: "lei"
    },
    RSD: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} RSD",
        currency_symbol: "RSD"
    },
    RUB: {
        money_format: "{{amount_with_comma_separator}}",
        money_with_currency_format: "{{amount_with_comma_separator}} RUB",
        currency_symbol: "₽"
    },
    RWF: {
        money_format: "{{amount_no_decimals}}",
        money_with_currency_format: "{{amount_no_decimals}} RWF",
        currency_symbol: "RF"
    },
    SAR: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} SAR",
        currency_symbol: "SR"
    },
    SBD: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} SBD",
        currency_symbol: "$"
    },
    SCR: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} SCR",
        currency_symbol: "₨"
    },
    SDG: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} SDG",
        currency_symbol: "£"
    },
    SEK: {
        money_format: "{{amount_no_decimals}}",
        money_with_currency_format: "{{amount_no_decimals}} SEK",
        currency_symbol: "kr"
    },
    SGD: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} SGD",
        currency_symbol: "S$"
    },
    SHP: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} SHP",
        currency_symbol: "£"
    },
    SKK: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} SKK",
        currency_symbol: "SKK"
    },
    SLL: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} SLL",
        currency_symbol: "Le"
    },
    SOS: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} SOS",
        currency_symbol: "S"
    },
    SPL: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} SPL",
        currency_symbol: "SPL"
    },
    SRD: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} SRD",
        currency_symbol: "$"
    },
    STD: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} STD",
        currency_symbol: "Db"
    },
    SVC: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} SVC",
        currency_symbol: "$"
    },
    SYP: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} SYP",
        currency_symbol: "S£"
    },
    SZL: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} SZL",
        currency_symbol: "L"
    },
    THB: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} THB",
        currency_symbol: "฿"
    },
    TJS: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} TJS",
        currency_symbol: "TJS"
    },
    TMT: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} TMT",
        currency_symbol: "m"
    },
    TND: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} DT",
        currency_symbol: "DT"
    },
    TOP: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} TOP",
        currency_symbol: "T$"
    },
    TRY: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} TRY",
        currency_symbol: "TL"
    },
    TTD: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} TTD",
        currency_symbol: "$"
    },
    TVD: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} TVD",
        currency_symbol: "TVD"
    },
    TWD: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} TWD",
        currency_symbol: "$"
    },
    TZS: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} TZS",
        currency_symbol: "TZS"
    },
    UAH: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} UAH",
        currency_symbol: "₴"
    },
    UGX: {
        money_format: "{{amount_no_decimals}}",
        money_with_currency_format: "{{amount_no_decimals}} UGX",
        currency_symbol: "Ush"
    },
    USD: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} USD",
        currency_symbol: "$"
    },
    UYU: {
        money_format: "{{amount_with_comma_separator}}",
        money_with_currency_format: "{{amount_with_comma_separator}} UYU",
        currency_symbol: "$"
    },
    UZS: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} UZS",
        currency_symbol: "лв"
    },
    VEF: {
        money_format: "{{amount_with_comma_separator}}",
        money_with_currency_format: "{{amount_with_comma_separator}} VEF",
        currency_symbol: "Bs."
    },
    VND: {
        money_format: "{{amount_no_decimals_with_comma_separator}}",
        money_with_currency_format: "{{amount_no_decimals_with_comma_separator}} VND",
        currency_symbol: "₫"
    },
    VUV: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} VT",
        currency_symbol: "$"
    },
    WST: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} WST",
        currency_symbol: "WS$"
    },
    XAF: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} XAF",
        currency_symbol: "FCFA"
    },
    XAG: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} XAG",
        currency_symbol: "XAG"
    },
    XAU: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} XAU",
        currency_symbol: "XAU"
    },
    XCD: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} XCD",
        currency_symbol: "EC$"
    },
    XDR: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} XDR",
        currency_symbol: "XDR"
    },
    XOF: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} XOF",
        currency_symbol: "CFA"
    },
    XPD: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} XPD",
        currency_symbol: "XPD"
    },
    XPF: {
        money_format: "{{amount_no_decimals_with_comma_separator}}",
        money_with_currency_format: "{{amount_no_decimals_with_comma_separator}} XPF",
        currency_symbol: "XPF"
    },
    XPT: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} XPT",
        currency_symbol: "XPT"
    },
    YER: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} YER",
        currency_symbol: "﷼"
    },
    ZAR: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} ZAR",
        currency_symbol: "R"
    },
    ZMW: {
        money_format: "{{amount_no_decimals_with_comma_separator}}",
        money_with_currency_format: "{{amount_no_decimals_with_comma_separator}} ZMW",
        currency_symbol: "K"
    },
    ZWD: {
        money_format: "{{amount}}",
        money_with_currency_format: "{{amount}} ZWD",
        currency_symbol: "ZWD"
    }
}