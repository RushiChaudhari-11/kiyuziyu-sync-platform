import { getCleanDomain } from "./domain";

const META_PIXELS = {
  "kiyuziyuofficial.com": "2231396327679041",
   "wholesaleantitarnishjewellery.com":"53461596655610084",
  "kiyuziyubypawanratna.com": "930079726687326",
"kiyuziyujewellery.in": "1327934982509184",
"kiyuziyujewelery.in":"1517159163444755",
  // local development
  "localhost:3000": "1011222784602653",
  "localhost:3001": "1011222784602653",
  "127.0.0.1:3000": "1011222784602653",
  "wholesaleantitarnishjewellery.com": "2077794193166378",
};

export const initMetaPixel = () => {
  const domain = getCleanDomain();

  const pixelId = META_PIXELS[domain];

  console.log("Domain:", domain);
  console.log("Pixel:", pixelId);

  if (!pixelId) return;

  // Prevent duplicate initialization
  if (window.fbq) return;

 (function (f, b, e, v, n, t, s) {
  if (f.fbq) return;

  n = f.fbq = function () {
    n.callMethod
      ? n.callMethod.apply(n, arguments)
      : n.queue.push(arguments);
  };

  if (!f._fbq) f._fbq = n;

  n.push = n;
  n.loaded = true;
  n.version = "2.0";
  n.queue = [];

  t = b.createElement(e);
  t.async = true;
  t.src = v;

  s = b.getElementsByTagName(e)[0];
  s.parentNode.insertBefore(t, s);

})(
  window,
  document,
  "script",
  "https://connect.facebook.net/en_US/fbevents.js"
);

  window.fbq("init", pixelId);

  window.fbq("track", "PageView");
};
export const trackMetaEvent = (
  eventName,
  data = {}
) => {

  if (!window.fbq) return;

  window.fbq("track", eventName, data);

};