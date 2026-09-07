export const websiteFonts = [
  {
    value: "system",
    label: "Modern",
    family:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
  },
  {
    value: "georgia",
    label: "Georgia",
    family:
      'Georgia, "Times New Roman", serif',
  },
  {
    value: "times",
    label: "Classic Serif",
    family:
      '"Times New Roman", Times, serif',
  },
  {
    value: "trebuchet",
    label: "Trebuchet",
    family:
      '"Trebuchet MS", Arial, sans-serif',
  },
  {
    value: "verdana",
    label: "Verdana",
    family:
      'Verdana, Geneva, sans-serif',
  },
];

export const websiteDefaults = {
  primary_colour: "#7c644e",
  secondary_colour: "#f8f6f2",

  heading_font: "georgia",
  body_font: "system",
  navigation_font: "system",

  hero_title: "",
  hero_description: "",
  hero_image_url: "",

  show_about: true,
  show_services: true,
  show_portfolio: true,
  show_reviews: true,
  show_contact: true,
};

export function safeImageUrl(value) {
  if (!value) return "";

  try {
    const url = new URL(value);

    return url.protocol === "https:"
      ? url.href
      : "";
  } catch {
    return "";
  }
}

export function validSlug(value) {
  return (
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) &&
    value.length <= 100 &&
    ![
      "client",
      "photographer",
      "login",
      "signup",
      "assets",
      "api",
      "admin",
    ].includes(value)
  );
}

export function safeColour(value, fallback) {
  return /^#[0-9a-f]{6}$/i.test(value || "")
    ? value
    : fallback;
}

export function getWebsiteFont(
  value,
  fallback = "system"
) {
  const selectedFont = websiteFonts.find(
    (font) => font.value === value
  );

  if (selectedFont) {
    return selectedFont.family;
  }

  const fallbackFont = websiteFonts.find(
    (font) => font.value === fallback
  );

  return (
    fallbackFont?.family ||
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif'
  );
}