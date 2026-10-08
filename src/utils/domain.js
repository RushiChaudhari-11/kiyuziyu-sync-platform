export const MAIN_DOMAINS = [
  "kiyuziyuofficial.com",
  "wholesaleantitarnishjewellery.com",
];

export const getCleanDomain = () => {
  const rawHost = window.location.host.replace("www.", "");
  const domain = rawHost.split(":")[0];
  const port = window.location.port;

  // localhost:3000 acts as main domain
  if (
    (domain === "localhost" || domain === "127.0.0.1") &&
    port === "3000"
  ) {
    return MAIN_DOMAINS[0]; // default main domain in local
  }

  return rawHost;
};

export const isMainDomain = () => {
  const rawHost = window.location.host.replace("www.", "");

  return (
    MAIN_DOMAINS.includes(rawHost) ||
    rawHost === "localhost:3000" ||
    rawHost === "127.0.0.1:3000"
  );
};