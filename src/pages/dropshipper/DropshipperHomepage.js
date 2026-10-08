import React, { useEffect, useState } from "react";
import { doc, getDoc, setDoc, collection, getDocs } from "firebase/firestore";
import { db, storage } from "../../firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useAuth } from "../../components/AuthContext";
import "./DropshipperHomepage.css";
import StorePreview from "../store/StorePreview";
const DropshipperHomepage = () => {
  const { currentUser } = useAuth();

  const [userData, setUserData] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [previewDevice, setPreviewDevice] = useState("desktop");
  /* 🔥 NEW: COLLECTION LIST */
  const [collectionsList, setCollectionsList] = useState([]);

 const [about, setAbout] = useState({
  title: "",
  description: "",
  images: [],
  features: [
    {
      title: "Premium Materials",
      text: "Crafted with high quality metals & stones."
    },
    {
      title: "Timeless Design",
      text: "Elegant jewelry made for everyday luxury."
    },
    {
      title: "Trusted Quality",
      text: "Loved by customers worldwide."
    }
  ]
});
const [instagramReels, setInstagramReels] = useState({
  enabled: true,
  title: "Trending on Instagram",
  subtitle: "Real styles. Real moments.",
  reels: []
});
const [enquiryForm, setEnquiryForm] = useState({
  enabled: false,
  title: "Get In Touch",
  subtitle: "Have questions? Send us an enquiry and we'll contact you shortly."
});
  const [footer, setFooter] = useState({
    brand: "",
    description: "",
    address: "",
    phone: "",
    email: "",
    hours: "",

    links: [
      { label: "Shop", url: "/collections" },
      { label: "About", url: "/about" },
      { label: "Contact", url: "/contact" }
    ],

    socials: {
      instagram: "",
      facebook: "",
      twitter: ""
    },

    colors: {
      background: "#111111",
      text: "#ffffff",
      accent: "#C9A34E"
    }
  });
  const [floatingContact, setFloatingContact] = useState({
  whatsapp: "",
  instagram: "",
  phone: ""
});
const [shopTheLook, setShopTheLook] = useState({
  enabled: true,
  title: "SHOP THE LOOK",
  reels: []
});
  const [testimonials, setTestimonials] = useState({
    title: "What Our Customers Say",
    items: [
      {
        name: "Sophia",
        text: "Absolutely beautiful jewelry. The quality exceeded my expectations!",
        rating: 5
      }
    ]
  });
  const [topbar, setTopbar] = useState({
  items: [
    "Wholesale Price",
    "Anti-Tarnish Jewellery",
    "24*7 Support",
    "Login To View Wholesale Price",
    "Delivering Elegance Across India",
    "Minimum Order Value 2500"
  ]
});
  /* ================= STATES ================= */

  const [navbar, setNavbar] = useState({
    logo: "",
    brandName: ""
  });

  const [hero, setHero] = useState({
    layout: "split",

    title: "",
    subtitle: "",

    images: [],
    slides: [],

    buttonText: "Shop Now",
    secondaryButton: "Explore",

    features: []
  });
  const [theme, setTheme] = useState({
    colors: {
      primary: "#C9A34E",
      background: "#ffffff",
      text: "#111111"
    },
    font: "Playfair Display"
  });

  const [sections, setSections] = useState([]);

  /* ================= LOAD ================= */

  useEffect(() => {
    if (!currentUser) return;

    const load = async () => {
      try {
        const userRef = doc(db, "users", currentUser.uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
          setInitialLoading(false);
          return;
        }

        const user = userSnap.data();
        setUserData(user);

        if (!user.storeDomain) {
          setInitialLoading(false);
          return;
        }

        /* 🔥 LOAD ALL COLLECTIONS */
        const collectionsSnap = await getDocs(collection(db, "collections"));
        setCollectionsList(
          collectionsSnap.docs.map(d => ({
            id: d.id,
            ...d.data()
          }))
        );

        const snap = await getDoc(
          doc(db, "storeHomepages", user.storeDomain)
        );

        if (snap.exists()) {
          const data = snap.data();

          setNavbar(data.navbar || {});
          setTopbar(
  data.topbar || {
    items: [
      "Wholesale Price",
      "Anti-Tarnish Jewellery",
      "24*7 Support",
      "Login To View Wholesale Price",
      "Delivering Elegance Across India",
      "Minimum Order Value 2500"
    ]
  }
);
          setHero(prev => ({ ...prev, ...data.hero }));
          setTheme(data.theme || theme);
          setSections(data.sections || []);
          setAbout(
  data.about || {
    title: "",
    description: "",
    images: [],
    features: []
  }
);
setInstagramReels(
  data.instagramReels || {
    enabled: true,
    title: "Trending on Instagram",
    subtitle: "Real styles. Real moments.",
    reels: []
  }
);
setShopTheLook(
  data.shopTheLook || {
    enabled: true,
    title: "SHOP THE LOOK",
    reels: []
  }
);
          setTestimonials(data.testimonials || {
            title: "What Our Customers Say",
            items: []
          });
          setEnquiryForm(
  data.enquiryForm || {
    enabled: false,
    title: "Get In Touch",
    subtitle:
      "Have questions? Send us an enquiry and we'll contact you shortly."
  }
);
          setFloatingContact(
  data.floatingContact || {
    whatsapp: "",
    instagram: "",
    phone: ""
  }
);
          setFooter({
            brand: data.footer?.brand || "",
            description: data.footer?.description || "",
            address: data.footer?.address || "",
            phone: data.footer?.phone || "",
            email: data.footer?.email || "",
            hours: data.footer?.hours || "",

            links: data.footer?.links || [],

            socials: data.footer?.socials || {
              instagram: "",
              facebook: "",
              twitter: ""
            },

            colors: data.footer?.colors || {
              background: "#111111",
              text: "#ffffff",
              accent: "#C9A34E"
            }
          });
        }
      } catch (err) {
        console.error("❌ Load error:", err);
      }

      setInitialLoading(false);
    };

    load();
  }, [currentUser]);

  /* ================= UPLOAD ================= */

  const uploadImage = async (file, folder) => {
    if (!file || !userData?.storeDomain) return null;

    const path = `${folder}/${userData.storeDomain}/${Date.now()}`;
    const storageRef = ref(storage, path);

    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
  };

  /* ================= HERO ================= */

  const handleAddHeroImages = async (files) => {

    const urls = [];

    for (const file of files) {

      const url = await uploadImage(file, "hero");

      if (url) {
        urls.push({ src: url });
      }

    }

    setHero(prev => ({
      ...prev,
      images: [...(prev.images || []), ...urls]
    }));

  };
  /* ================= HERO CAROUSEL ================= */

  const addSlide = () => {
    setHero(prev => ({
      ...prev,
      slides: [
        ...(prev.slides || []),
        {
          image: "",
          mobileImage: "",
          tagline: "",
          title: "",
          desc: "",
          buttonText: "Shop Now",
          link: "#collections"
        }
      ]
    }));
  };

  const updateSlide = (index, field, value) => {
    setHero(prev => ({
      ...prev,
      slides: prev.slides.map((s, i) =>
        i === index ? { ...s, [field]: value } : s
      )
    }));
  };

  const removeSlide = (index) => {
    setHero(prev => ({
      ...prev,
      slides: prev.slides.filter((_, i) => i !== index)
    }));
  };

  const uploadSlideImage = async (file, index, field) => {
    const url = await uploadImage(file, "hero");

    if (!url) return;

    updateSlide(index, field, url);
  };

  const removeHeroImage = (index) => {
    setHero(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  const addFeature = () => {
    setHero(prev => ({
      ...prev,
      features: [...(prev.features || []), ""]
    }));
  };

  const updateFeature = (index, value) => {
    setHero(prev => ({
      ...prev,
      features: prev.features.map((f, i) =>
        i === index ? value : f
      )
    }));
  };

  const removeFeature = (index) => {
    setHero(prev => ({
      ...prev,
      features: prev.features.filter((_, i) => i !== index)
    }));
  };

  /* ================= COLLECTION HELPERS ================= */

  const updateCollection = (secIndex, colIndex, field, value) => {
    setSections(prev =>
      prev.map((sec, i) =>
        i === secIndex
          ? {
            ...sec,
            collections: sec.collections.map((col, ci) =>
              ci === colIndex
                ? { ...col, [field]: value }
                : col
            )
          }
          : sec
      )
    );
  };

  const addCollectionImages = async (secIndex, colIndex, files) => {

    const urls = [];

    for (const file of files) {

      const url = await uploadImage(file, "collections");

      if (url) urls.push(url);

    }

    setSections(prev =>
      prev.map((sec, i) =>
        i === secIndex
          ? {
            ...sec,
            collections: sec.collections.map((col, ci) =>
              ci === colIndex
                ? {
                  ...col,
                  additionalImages: [
                    ...(col.additionalImages || []),
                    ...urls
                  ]
                }
                : col
            )
          }
          : sec
      )
    );

  };

  const removeCollectionImage = (secIndex, colIndex, imgIndex) => {
    setSections(prev =>
      prev.map((sec, i) =>
        i === secIndex
          ? {
            ...sec,
            collections: sec.collections.map((col, ci) =>
              ci === colIndex
                ? {
                  ...col,
                  additionalImages:
                    col.additionalImages.filter(
                      (_, ii) => ii !== imgIndex
                    )
                }
                : col
            )
          }
          : sec
      )
    );
  };

  /* ================= SAVE ================= */

  const handleSave = async () => {
    if (!userData?.storeDomain) {
      alert("No store domain");
      return;
    }

    setLoading(true);

    try {
      await setDoc(
        doc(db, "storeHomepages", userData.storeDomain),
        {
          navbar,
          hero,
          theme,
          sections,
          about,
          testimonials,
          footer,
           floatingContact,
             topbar,
             enquiryForm,
              instagramReels,
                shopTheLook,
        },
        { merge: true }
      );

      alert("✅ Saved!");
    } catch (err) {
      console.error("❌ Save error:", err);
      alert("Error saving");
    }

    setLoading(false);
  };

  /* ================= UI ================= */

  if (initialLoading) {
    return <div style={{ padding: "40px" }}>Loading...</div>;
  }

  return (
    <div className="builder-layout">

      {/* LEFT SIDE — EDITOR */}
      <div className="builder-editor">

        <div className="customization-container">

          <h2>Store Customization</h2>

          {/* NAVBAR */}
          <div className="section-card">
            <h3>Navbar</h3>

            <input
              placeholder="Brand Name"
              value={navbar.brandName || ""}
              onChange={(e) =>
                setNavbar(prev => ({
                  ...prev,
                  brandName: e.target.value
                }))
              }
            />

            <input
              type="file"
              onChange={async (e) => {
                const url = await uploadImage(e.target.files[0], "navbar");
                if (url) {
                  setNavbar(prev => ({ ...prev, logo: url }));
                }
              }}
            />

            {navbar.logo && (
              <div className="image-preview">
                <img src={navbar.logo} alt="" />
              </div>
            )}
          </div>
          <div className="section-card">
  <h3>Top Bar Text</h3>

  {topbar.items.map((item, index) => (
    <input
      key={index}
      value={item}
      placeholder={`Message ${index + 1}`}
      onChange={(e) => {

        const updated = [...topbar.items];
        updated[index] = e.target.value;

        setTopbar({
          ...topbar,
          items: updated
        });

      }}
    />
  ))}
</div>


          {/* HERO */}
          <div className="section-card">

            <h3>Hero</h3>

            <h4>Hero Layout</h4>

            <select
              value={hero.layout}
              onChange={(e) =>
                setHero(prev => ({
                  ...prev,
                  layout: e.target.value
                }))
              }
            >
              <option value="split">Split Hero</option>
              <option value="center">Centered Hero</option>
              <option value="carousel">Carousel Hero</option>
              <option value="minimal">Minimal Hero</option>
            </select>


            {/* TITLE + SUBTITLE (not for carousel) */}
            {hero.layout !== "carousel" && (
              <>
                <input
                  placeholder="Title"
                  value={hero.title}
                  onChange={(e) =>
                    setHero(prev => ({
                      ...prev,
                      title: e.target.value
                    }))
                  }
                />

                <input
                  placeholder="Subtitle"
                  value={hero.subtitle}
                  onChange={(e) =>
                    setHero(prev => ({
                      ...prev,
                      subtitle: e.target.value
                    }))
                  }
                />
              </>
            )}


            {/* FEATURES (only for split hero) */}
            {hero.layout === "split" && (
              <>
                <h4>Hero Features</h4>

                <button className="add-btn" onClick={addFeature}>
                  + Add Feature
                </button>

                <div className="features-editor">

                  {hero.features?.map((f, i) => (
                    <div key={i} className="feature-row">

                      <input
                        placeholder="Feature text"
                        value={f}
                        onChange={(e) => updateFeature(i, e.target.value)}
                      />

                      <button
                        className="secondary"
                        onClick={() => removeFeature(i)}
                      >
                        Remove
                      </button>

                    </div>
                  ))}

                </div>
              </>
            )}


            {/* HERO IMAGES (not for carousel) */}
            {hero.layout !== "carousel" && (
              <>

                <h4>Hero Images</h4>

                <input
                  type="file"
                  multiple
                  onChange={(e) => handleAddHeroImages(e.target.files)}
                />

                <div className="image-preview">

                  {hero.images?.map((img, i) => (
                    <div key={i}>

                      <img src={img.src} alt="" />

                      <button
                        className="secondary"
                        onClick={() => removeHeroImage(i)}
                      >
                        Remove
                      </button>

                    </div>
                  ))}

                </div>

              </>
            )}


            {/* CAROUSEL SLIDES */}
            {hero.layout === "carousel" && (

              <div className="carousel-editor">

                <h4>Carousel Slides</h4>

                <button className="add-btn" onClick={addSlide}>
                  + Add Slide
                </button>


                {hero.slides?.map((slide, i) => (
                  <div key={i} className="carousel-slide-card">

                    <input
                      placeholder="Tagline"
                      value={slide.tagline || ""}
                      onChange={(e) =>
                        updateSlide(i, "tagline", e.target.value)
                      }
                    />

                    <input
                      placeholder="Title"
                      value={slide.title || ""}
                      onChange={(e) =>
                        updateSlide(i, "title", e.target.value)
                      }
                    />

                    <input
                      placeholder="Description"
                      value={slide.desc || ""}
                      onChange={(e) =>
                        updateSlide(i, "desc", e.target.value)
                      }
                    />

                    <input
                      placeholder="Button Text"
                      value={slide.buttonText || ""}
                      onChange={(e) =>
                        updateSlide(i, "buttonText", e.target.value)
                      }
                    />

                    <input
                      placeholder="Link"
                      value={slide.link || ""}
                      onChange={(e) =>
                        updateSlide(i, "link", e.target.value)
                      }
                    />


                    <label>Desktop Image</label>
                    <input
                      type="file"
                      onChange={(e) =>
                        uploadSlideImage(e.target.files[0], i, "image")
                      }
                    />

                    {slide.image && (
                      <div className="image-preview">
                        <img src={slide.image} alt="" />
                      </div>
                    )}


                    <label>Mobile Image</label>
                    <input
                      type="file"
                      onChange={(e) =>
                        uploadSlideImage(e.target.files[0], i, "mobileImage")
                      }
                    />

                    {slide.mobileImage && (
                      <div className="image-preview">
                        <img src={slide.mobileImage} alt="" />
                      </div>
                    )}


                    <button
                      className="secondary"
                      onClick={() => removeSlide(i)}
                    >
                      Remove Slide
                    </button>

                  </div>
                ))}

              </div>

            )}

          </div>


          {/* COLLECTION SECTIONS */}
          <div className="section-card">
            <h3>Collections</h3>

            <button
              className="add-btn"
              onClick={() =>
                setSections(prev => [
                  ...prev,
                  {
                    id: Date.now(),
                    type: "collections",
                    title: "New Section",
                    collections: []
                  }
                ])
              }
            >
              + Add Section
            </button>

            {sections.map((sec, secIndex) => (
              <div key={sec.id} className="collection-card">

                <input
                  value={sec.title}
                  onChange={(e) => {
                    const updated = [...sections];
                    updated[secIndex].title = e.target.value;
                    setSections(updated);
                  }}
                />
                <button
                  className="secondary"
                  onClick={() =>
                    setSections(prev =>
                      prev.filter((_, i) => i !== secIndex)
                    )
                  }
                >
                  Remove Section
                </button>

                <button
                  className="secondary"
                  onClick={() =>
                    setSections(prev =>
                      prev.map((s, i) =>
                        i === secIndex
                          ? {
                            ...s,
                            collections: [
                              ...s.collections,
                              {
                                id: Date.now(),
                                title: "",
                                image: "",
                                additionalImages: [],
                                openCollectionId: ""
                              }
                            ]
                          }
                          : s
                      )
                    )
                  }
                >
                  + Add Collection
                </button>

                {sec.collections.map((col, colIndex) => (
                  <div key={col.id} className="collection-card">

                    <input
                      placeholder="Title"
                      value={col.title}
                      onChange={(e) =>
                        updateCollection(
                          secIndex,
                          colIndex,
                          "title",
                          e.target.value
                        )
                      }
                    />
                    <button
                      className="secondary"
                      onClick={() =>
                        setSections(prev =>
                          prev.map((sec, i) =>
                            i === secIndex
                              ? {
                                ...sec,
                                collections: sec.collections.filter(
                                  (_, ci) => ci !== colIndex
                                )
                              }
                              : sec
                          )
                        )
                      }
                    >
                      Remove Collection
                    </button>

                    <select
                      value={col.openCollectionId || ""}
                      onChange={(e) =>
                        updateCollection(
                          secIndex,
                          colIndex,
                          "openCollectionId",
                          e.target.value
                        )
                      }
                    >
                      <option value="">Select Collection</option>
                      {collectionsList.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.title}
                        </option>
                      ))}
                    </select>

                    <input
                      type="file"
                      onChange={async (e) => {
                        const url = await uploadImage(
                          e.target.files[0],
                          "collections"
                        );
                        updateCollection(secIndex, colIndex, "image", url);
                      }}
                    />

                    {col.image && (
                      <div className="image-preview">
                        <img src={col.image} alt="" />
                      </div>
                    )}

                    <input
                      type="file"
                      multiple
                      onChange={(e) =>
                        addCollectionImages(secIndex, colIndex, e.target.files)
                      }
                    />

                    <div className="image-preview">
                      {col.additionalImages?.map((img, i) => (
                        <div key={i}>
                          <img src={img} alt="" />
                          <button
                            className="secondary"
                            onClick={() =>
                              removeCollectionImage(
                                secIndex,
                                colIndex,
                                i
                              )
                            }
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>

                  </div>
                ))}
              </div>
            ))}
          </div>
          {/* <div className="section-card">
  <h3>Instagram Reels</h3>

  <label>
    <input
      type="checkbox"
      checked={instagramReels.enabled}
      onChange={(e) =>
        setInstagramReels(prev => ({
          ...prev,
          enabled: e.target.checked
        }))
      }
    />
    Enable Instagram Reels
  </label>

  <input
    placeholder="Section Title"
    value={instagramReels.title}
    onChange={(e) =>
      setInstagramReels(prev => ({
        ...prev,
        title: e.target.value
      }))
    }
  />

  <input
    placeholder="Section Subtitle"
    value={instagramReels.subtitle}
    onChange={(e) =>
      setInstagramReels(prev => ({
        ...prev,
        subtitle: e.target.value
      }))
    }
  />

  <button
    className="add-btn"
    onClick={() =>
      setInstagramReels(prev => ({
        ...prev,
        reels: [
          ...(prev.reels || []),
          {
            videoUrl: "",
            thumbnail: ""
          }
        ]
      }))
    }
  >
    + Add Reel
  </button>

  {instagramReels.reels?.map((reel, index) => (
    <div key={index} className="collection-card">

      <label>Video</label>

      <input
        type="file"
        accept="video/*"
        onChange={async (e) => {
          const url = await uploadImage(
            e.target.files[0],
            "instagram-reels"
          );

          if (!url) return;

          const updated = [...instagramReels.reels];
          updated[index].videoUrl = url;

          setInstagramReels(prev => ({
            ...prev,
            reels: updated
          }));
        }}
      />

      <label>Thumbnail</label>

      <input
        type="file"
        accept="image/*"
        onChange={async (e) => {
          const url = await uploadImage(
            e.target.files[0],
            "instagram-reels"
          );

          if (!url) return;

          const updated = [...instagramReels.reels];
          updated[index].thumbnail = url;

          setInstagramReels(prev => ({
            ...prev,
            reels: updated
          }));
        }}
      />

      {reel.thumbnail && (
        <div className="image-preview">
          <img src={reel.thumbnail} alt="" />
        </div>
      )}

      <button
        className="secondary"
        onClick={() => {
          const updated = instagramReels.reels.filter(
            (_, i) => i !== index
          );

          setInstagramReels(prev => ({
            ...prev,
            reels: updated
          }));
        }}
      >
        Remove Reel
      </button>
    </div>
  ))}
</div> */}
{userData?.enabledFeatures?.shopTheLook && (
<div className="section-card">
  <h3>Shop The Look</h3>

  <label>
    <input
      type="checkbox"
      checked={shopTheLook.enabled}
      onChange={(e) =>
        setShopTheLook(prev => ({
          ...prev,
          enabled: e.target.checked
        }))
      }
    />
    Enable Shop The Look
  </label>

  <input
    placeholder="Section Title"
    value={shopTheLook.title}
    onChange={(e) =>
      setShopTheLook(prev => ({
        ...prev,
        title: e.target.value
      }))
    }
  />

  <button
    className="add-btn"
    onClick={() =>
      setShopTheLook(prev => ({
        ...prev,
        reels: [
          ...(prev.reels || []),
          {
            videoUrl: ""
          }
        ]
      }))
    }
  >
    + Add Reel
  </button>

  {shopTheLook.reels?.map((reel, index) => (
    <div key={index} className="collection-card">

      <label>Video Reel</label>

      <input
        type="file"
        accept="video/*"
        onChange={async (e) => {
          const url = await uploadImage(
            e.target.files[0],
            "shop-the-look"
          );

          if (!url) return;

          const updated = [...shopTheLook.reels];
          updated[index].videoUrl = url;

          setShopTheLook(prev => ({
            ...prev,
            reels: updated
          }));
        }}
      />

      {reel.videoUrl && (
        <video
          src={reel.videoUrl}
          controls
          style={{
            width: "180px",
            borderRadius: "12px",
            marginTop: "10px"
          }}
        />
      )}

      <button
        className="secondary"
        onClick={() => {
          const updated = shopTheLook.reels.filter(
            (_, i) => i !== index
          );

          setShopTheLook(prev => ({
            ...prev,
            reels: updated
          }));
        }}
      >
        Remove Reel
      </button>

    </div>
  ))}
</div>
)}
          <div className="section-card">
            <h3>About Section</h3>

            <input
              placeholder="Title"
              value={about.title}
              onChange={(e) =>
                setAbout(prev => ({
                  ...prev,
                  title: e.target.value
                }))
              }
            />

            <textarea
              placeholder="Description"
              value={about.description}
              onChange={(e) =>
                setAbout(prev => ({
                  ...prev,
                  description: e.target.value
                }))
              }
            />

           <input
  type="file"
  multiple
  onChange={async (e) => {
    const files = Array.from(e.target.files);

    const urls = [];

    for (const file of files) {
      const url = await uploadImage(file, "about");

      if (url) {
        urls.push(url);
      }
    }

    setAbout(prev => ({
      ...prev,
      images: [...(prev.images || []), ...urls]
    }));
  }}
/>
<div className="image-preview">
  {about.images?.map((img, index) => (
    <div key={index}>
      <img src={img} alt="" />

      <button
        className="secondary"
        onClick={() =>
          setAbout(prev => ({
            ...prev,
            images: prev.images.filter((_, i) => i !== index)
          }))
        }
      >
        Remove
      </button>
    </div>
  ))}
</div>
            <h4>Features</h4>

            <button
              className="add-btn"
              onClick={() =>
                setAbout(prev => ({
                  ...prev,
                  features: [
                    ...(prev.features || []),
                    { title: "", text: "" }
                  ]
                }))
              }
            >
              + Add Feature
            </button>

            {about.features?.map((f, i) => (

              <div key={i} className="feature-row">

                <input
                  placeholder="Feature title"
                  value={f.title}
                  onChange={(e) => {

                    const updated = [...about.features];
                    updated[i].title = e.target.value;

                    setAbout(prev => ({
                      ...prev,
                      features: updated
                    }));

                  }}
                />

                <input
                  placeholder="Feature description"
                  value={f.text}
                  onChange={(e) => {

                    const updated = [...about.features];
                    updated[i].text = e.target.value;

                    setAbout(prev => ({
                      ...prev,
                      features: updated
                    }));

                  }}
                />

                <button
                  className="secondary"
                  onClick={() => {

                    const updated = about.features.filter((_, index) => index !== i);

                    setAbout(prev => ({
                      ...prev,
                      features: updated
                    }));

                  }}
                >
                  Remove
                </button>

              </div>

            ))}
          </div>
          <div className="section-card">

  <h3>Enquiry Form</h3>

  <label>
    <input
      type="checkbox"
      checked={enquiryForm.enabled}
      onChange={(e) =>
        setEnquiryForm(prev => ({
          ...prev,
          enabled: e.target.checked
        }))
      }
    />

    Enable Enquiry Form
  </label>

  <input
    placeholder="Title"
    value={enquiryForm.title}
    onChange={(e) =>
      setEnquiryForm(prev => ({
        ...prev,
        title: e.target.value
      }))
    }
  />

  <textarea
    placeholder="Subtitle"
    value={enquiryForm.subtitle}
    onChange={(e) =>
      setEnquiryForm(prev => ({
        ...prev,
        subtitle: e.target.value
      }))
    }
  />

</div>
          <div className="section-card">

            <h3>Testimonials</h3>

            <input
              placeholder="Section Title"
              value={testimonials.title}
              onChange={(e) =>
                setTestimonials(prev => ({
                  ...prev,
                  title: e.target.value
                }))
              }
            />

            <button
              className="add-btn"
              onClick={() =>
                setTestimonials(prev => ({
                  ...prev,
                  items: [
                    ...prev.items,
                    { name: "", text: "", rating: 5 }
                  ]
                }))
              }
            >
              + Add Testimonial
            </button>

            {testimonials.items.map((t, i) => (
              <div key={i} className="feature-row">

                <input
                  placeholder="Customer Name"
                  value={t.name}
                  onChange={(e) => {
                    const updated = [...testimonials.items]
                    updated[i].name = e.target.value
                    setTestimonials(prev => ({ ...prev, items: updated }))
                  }}
                />

                <textarea
                  placeholder="Review"
                  value={t.text}
                  onChange={(e) => {
                    const updated = [...testimonials.items]
                    updated[i].text = e.target.value
                    setTestimonials(prev => ({ ...prev, items: updated }))
                  }}
                />

              </div>
            ))}

          </div>
          <div className="section-card">

            <h3>Footer</h3>

            <input
              placeholder="Brand Name"
              value={footer.brand}
              onChange={(e) => setFooter(prev => ({
                ...prev,
                brand: e.target.value
              }))}
            />

            <textarea
              placeholder="Description"
              value={footer.description}
              onChange={(e) => setFooter(prev => ({
                ...prev,
                description: e.target.value
              }))}
            />

            <input
              placeholder="Address"
              value={footer.address}
              onChange={(e) => setFooter(prev => ({
                ...prev,
                address: e.target.value
              }))}
            />

            <input
              placeholder="Phone"
              value={footer.phone}
              onChange={(e) => setFooter(prev => ({
                ...prev,
                phone: e.target.value
              }))}
            />

            <input
              placeholder="Email"
              value={footer.email}
              onChange={(e) => setFooter(prev => ({
                ...prev,
                email: e.target.value
              }))}
            />

            <input
              placeholder="Business Hours"
              value={footer.hours}
              onChange={(e) => setFooter(prev => ({
                ...prev,
                hours: e.target.value
              }))}
            />

            <h4>Social Links</h4>

            <input
              placeholder="Instagram"
              value={footer.socials.instagram}
              onChange={(e) => setFooter(prev => ({
                ...prev,
                socials: { ...prev.socials, instagram: e.target.value }
              }))}
            />

            <input
              placeholder="Facebook"
              value={footer.socials.facebook}
              onChange={(e) => setFooter(prev => ({
                ...prev,
                socials: { ...prev.socials, facebook: e.target.value }
              }))}
            />

            <input
              placeholder="Twitter"
              value={footer.socials.twitter}
              onChange={(e) => setFooter(prev => ({
                ...prev,
                socials: { ...prev.socials, twitter: e.target.value }
              }))}
            />

          </div>
          <div className="section-card">
  <h3>Floating Contact</h3>

  <input
    placeholder="WhatsApp Number"
    value={floatingContact.whatsapp}
    onChange={(e) =>
      setFloatingContact(prev => ({
        ...prev,
        whatsapp: e.target.value
      }))
    }
  />

  <input
    placeholder="Phone Number"
    value={floatingContact.phone}
    onChange={(e) =>
      setFloatingContact(prev => ({
        ...prev,
        phone: e.target.value
      }))
    }
  />

  <input
    placeholder="Instagram URL"
    value={floatingContact.instagram}
    onChange={(e) =>
      setFloatingContact(prev => ({
        ...prev,
        instagram: e.target.value
      }))
    }
  />
</div>
          <h4>Footer Colors</h4>

          <label>Background</label>

          <input
            type="color"
            value={footer.colors.background}
            onChange={(e) =>
              setFooter(prev => ({
                ...prev,
                colors: {
                  ...prev.colors,
                  background: e.target.value
                }
              }))
            }
          />

          <label>Text</label>

          <input
            type="color"
            value={footer.colors.text}
            onChange={(e) =>
              setFooter(prev => ({
                ...prev,
                colors: {
                  ...prev.colors,
                  text: e.target.value
                }
              }))
            }
          />

          <label>Accent</label>

          <input
            type="color"
            value={footer.colors.accent}
            onChange={(e) =>
              setFooter(prev => ({
                ...prev,
                colors: {
                  ...prev.colors,
                  accent: e.target.value
                }
              }))
            }
          />
          <div className="section-card theme-section">

            <h3>Theme</h3>

            {/* PRIMARY COLOR */}
            <div className="theme-color-row">
              <label>Primary Color</label>
              <input
                type="color"
                value={theme.colors.primary}
                onChange={(e) =>
                  setTheme(prev => ({
                    ...prev,
                    colors: { ...prev.colors, primary: e.target.value }
                  }))
                }
              />
            </div>

            {/* BACKGROUND */}
            <div className="theme-color-row">
              <label>Background</label>
              <input
                type="color"
                value={theme.colors.background}
                onChange={(e) =>
                  setTheme(prev => ({
                    ...prev,
                    colors: { ...prev.colors, background: e.target.value }
                  }))
                }
              />
            </div>

            {/* TEXT COLOR */}
            <div className="theme-color-row">
              <label>Text Color</label>
              <input
                type="color"
                value={theme.colors.text}
                onChange={(e) =>
                  setTheme(prev => ({
                    ...prev,
                    colors: { ...prev.colors, text: e.target.value }
                  }))
                }
              />
            </div>

            {/* FONT */}
            <div className="theme-font">
              <label>Font</label>

              <select
                value={theme.font}
                onChange={(e) =>
                  setTheme(prev => ({
                    ...prev,
                    font: e.target.value
                  }))
                }
              >
                <option>Playfair Display</option>
                <option>Poppins</option>
                <option>Inter</option>
              </select>
            </div>

          </div>


          {/* SAVE */}
          <button
            className="save-btn"
            onClick={handleSave}
            disabled={loading}
          >
            {loading ? "Saving..." : "Save Changes"}
          </button>

        </div>
      </div>

      {/* RIGHT SIDE — PREVIEW */}
      <div className="builder-preview">

        <h3 style={{ marginBottom: "15px" }}>Live Store Preview</h3>

        <div className="preview-toolbar">

          <button
            className={previewDevice === "desktop" ? "active" : ""}
            onClick={() => setPreviewDevice("desktop")}
          >
            Desktop
          </button>

          <button
            className={previewDevice === "tablet" ? "active" : ""}
            onClick={() => setPreviewDevice("tablet")}
          >
            Tablet
          </button>

          <button
            className={previewDevice === "mobile" ? "active" : ""}
            onClick={() => setPreviewDevice("mobile")}
          >
            Mobile
          </button>

        </div>

        <div className="preview-container">

          <div className={`preview-frame ${previewDevice}`}>

            <StorePreview
              navbar={navbar}
              hero={hero}
              theme={theme}
              sections={sections}
              about={about}
              testimonials={testimonials}
              footer={footer}
            />

          </div>

        </div>

      </div>

    </div>

  );
};

export default DropshipperHomepage;