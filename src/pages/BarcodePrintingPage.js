import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  collection,
  getDocs,
} from "firebase/firestore";

import { db } from "../firebase";
import QRCode from "qrcode";

import "./Barcode.css";

/* =========================================================
   SCREEN QR LABEL
========================================================= */

const BarcodeLabel = ({
  product,
  subcollectionName,
  printLayout,
}) => {
  const svgRef = useRef(null);

  useEffect(() => {
    if (!svgRef.current) return;

    const generateQRCode = async () => {
      svgRef.current.innerHTML = "";

      const productId = String(
        product?.id || ""
      ).trim();

      if (!productId) return;

      try {
        const qrSvg = await QRCode.toString(
          productId,
          {
            type: "svg",
            errorCorrectionLevel: "L",
            margin: 0,
            color: {
              dark: "#000000",
              light: "#ffffff",
            },
          }
        );

        const parser = new DOMParser();

        const qrDocument =
          parser.parseFromString(
            qrSvg,
            "image/svg+xml"
          );

        const generatedSvg =
          qrDocument.documentElement;

        Array.from(
          generatedSvg.attributes
        ).forEach((attribute) => {
          svgRef.current.setAttribute(
            attribute.name,
            attribute.value
          );
        });

        Array.from(
          generatedSvg.childNodes
        ).forEach((node) => {
          svgRef.current.appendChild(
            node.cloneNode(true)
          );
        });

        svgRef.current.setAttribute(
          "data-qr-value",
          productId
        );

        svgRef.current.setAttribute(
          "preserveAspectRatio",
          "none"
        );

        svgRef.current.style.display =
          "block";

        svgRef.current.style.margin = "0";
        svgRef.current.style.padding = "0";
        svgRef.current.style.overflow =
          "visible";
      } catch (error) {
        console.error(
          "QR generation failed:",
          error
        );
      }
    };

    generateQRCode();
  }, [product?.id]);

  const productName =
    product?.productName ||
    product?.name ||
    "";

  const productCode =
    product?.productCode || "-";

  const isLarge =
    printLayout ===
    "THERMAL_47_5X25";

  return (
    <div
      className={`barcode-label ${
        isLarge
          ? "label-47-5-25"
          : "label-32-5-18"
      }`}
    >
      <svg
        ref={svgRef}
        className="screen-qr"
        data-product-id={String(
          product?.id || ""
        ).trim()}
      />

      <div className="screen-label-text">
        <strong>
          {productName}
        </strong>

        <div>
          {subcollectionName}
        </div>

        <div>
          Code: {productCode}
        </div>
      </div>
    </div>
  );
};


/* =========================================================
   MAIN PAGE
========================================================= */

const BarcodePrintingPage = () => {
  const pdfRef = useRef(null);

  /* =======================================================
     STATE
  ======================================================= */

  const [
    collections,
    setCollections,
  ] = useState([]);

  const [
    subcollections,
    setSubcollections,
  ] = useState([]);

  const [
    products,
    setProducts,
  ] = useState([]);

  const [
    selectedCollectionId,
    setSelectedCollectionId,
  ] = useState("");

  const [
    selectedSubcollectionId,
    setSelectedSubcollectionId,
  ] = useState("");

  const [
    selectedProductIds,
    setSelectedProductIds,
  ] = useState([]);

  const [
    productQuantities,
    setProductQuantities,
  ] = useState({});

  /*
   * Default:
   *
   * 32.5 × 18 mm
   */
  const [
    printLayout,
    setPrintLayout,
  ] = useState(
    "THERMAL_32_5X18"
  );


  /* =======================================================
     FETCH COLLECTIONS
  ======================================================= */

  useEffect(() => {
    const fetchCollections =
      async () => {
        try {
          const snap =
            await getDocs(
              collection(
                db,
                "collections"
              )
            );

          setCollections(
            snap.docs.map((doc) => ({
              id: doc.id,
              ...doc.data(),
            }))
          );
        } catch (error) {
          console.error(
            "Error fetching collections:",
            error
          );
        }
      };

    fetchCollections();
  }, []);


  /* =======================================================
     FETCH SUBCOLLECTIONS
  ======================================================= */

  useEffect(() => {
    if (!selectedCollectionId) {
      setSubcollections([]);
      setProducts([]);
      setSelectedSubcollectionId("");
      setSelectedProductIds([]);
      setProductQuantities({});
      return;
    }

    const fetchSubcollections =
      async () => {
        try {
          const snap =
            await getDocs(
              collection(
                db,
                "collections",
                selectedCollectionId,
                "subcollections"
              )
            );

          setSubcollections(
            snap.docs.map((doc) => ({
              id: doc.id,
              ...doc.data(),
            }))
          );
        } catch (error) {
          console.error(
            "Error fetching subcollections:",
            error
          );

          setSubcollections([]);
        }
      };

    setSelectedSubcollectionId("");
    setProducts([]);
    setSelectedProductIds([]);
    setProductQuantities({});

    fetchSubcollections();
  }, [
    selectedCollectionId,
  ]);


  /* =======================================================
     FETCH PRODUCTS
  ======================================================= */

  useEffect(() => {
    if (
      !selectedCollectionId ||
      !selectedSubcollectionId
    ) {
      setProducts([]);
      setSelectedProductIds([]);
      setProductQuantities({});
      return;
    }

    const fetchProducts =
      async () => {
        try {
          const snap =
            await getDocs(
              collection(
                db,
                "collections",
                selectedCollectionId,
                "subcollections",
                selectedSubcollectionId,
                "products"
              )
            );

          const productList =
            snap.docs.map((doc) => ({
              id: doc.id,
              ...doc.data(),
            }));

          setProducts(productList);

          setSelectedProductIds([]);
          setProductQuantities({});
        } catch (error) {
          console.error(
            "Error fetching products:",
            error
          );

          setProducts([]);
        }
      };

    fetchProducts();
  }, [
    selectedCollectionId,
    selectedSubcollectionId,
  ]);


  /* =======================================================
     SELECTED SUBCOLLECTION NAME
  ======================================================= */

  const selectedSubcollectionName =
    useMemo(() => {
      const found =
        subcollections.find(
          (item) =>
            item.id ===
            selectedSubcollectionId
        );

      return (
        found?.name ||
        found?.subcollectionName ||
        found?.title ||
        ""
      );
    }, [
      subcollections,
      selectedSubcollectionId,
    ]);


  /* =======================================================
     SELECTED PRODUCTS
  ======================================================= */

  const selectedProducts =
    useMemo(() => {
      return products.filter(
        (product) =>
          selectedProductIds.includes(
            product.id
          )
      );
    }, [
      products,
      selectedProductIds,
    ]);


  /* =======================================================
     EXPAND QUANTITIES
  ======================================================= */

  const printableProducts =
    useMemo(() => {
      const result = [];

      selectedProducts.forEach(
        (product) => {
          const quantity =
            Math.max(
              1,
              Number(
                productQuantities[
                  product.id
                ] || 1
              )
            );

          for (
            let i = 0;
            i < quantity;
            i++
          ) {
            result.push({
              ...product,
              __printIndex: i,
            });
          }
        }
      );

      return result;
    }, [
      selectedProducts,
      productQuantities,
    ]);


  /* =======================================================
     NEW PRODUCT
  ======================================================= */

  const isNewProduct = (
    product
  ) => {
    if (!product) return false;

    const createdAt =
      product.createdAt ||
      product.created_at ||
      product.createdDate;

    if (!createdAt) return false;

    let createdDate;

    if (
      typeof createdAt?.toDate ===
      "function"
    ) {
      createdDate =
        createdAt.toDate();
    } else {
      createdDate =
        new Date(createdAt);
    }

    if (
      Number.isNaN(
        createdDate.getTime()
      )
    ) {
      return false;
    }

    const difference =
      Date.now() -
      createdDate.getTime();

    const sevenDays =
      7 *
      24 *
      60 *
      60 *
      1000;

    return (
      difference >= 0 &&
      difference <= sevenDays
    );
  };


  /* =======================================================
     TOGGLE PRODUCT
  ======================================================= */

  const toggleProduct = (
    productId
  ) => {
    setSelectedProductIds(
      (previous) => {
        if (
          previous.includes(
            productId
          )
        ) {
          return previous.filter(
            (id) =>
              id !== productId
          );
        }

        return [
          ...previous,
          productId,
        ];
      }
    );

    setProductQuantities(
      (previous) => {
        if (
          previous[productId]
        ) {
          return previous;
        }

        return {
          ...previous,
          [productId]: 1,
        };
      }
    );
  };


  /* =======================================================
     SELECT ALL
  ======================================================= */

  const selectAllProducts =
    () => {
      const ids =
        products.map(
          (product) =>
            product.id
        );

      const quantities = {};

      ids.forEach(
        (id) => {
          quantities[id] =
            productQuantities[id] ||
            1;
        }
      );

      setSelectedProductIds(ids);
      setProductQuantities(
        quantities
      );
    };


  /* =======================================================
     CLEAR ALL
  ======================================================= */

  const clearAllProducts =
    () => {
      setSelectedProductIds([]);
      setProductQuantities({});
    };


  /* =======================================================
     TOTAL LABELS
  ======================================================= */

  const totalLabelCount =
    printableProducts.length;


  /* =======================================================
     EXACT PRN-BASED PRINT CONFIGURATION
     
     IMPORTANT:
     
     We are NOT treating the TSC dot coordinates
     as CSS millimetres.

     The PRN is the reference for the visual layout.

     FORMAT 1:
     SIZE 47.5 mm, 25 mm

     QRCODE:
     333,127,L,4,A,180,M2,S7

     TEXT:
     330,176,"0",180,12,12
     200,127,"0",180,12,12
     200,76,"0",180,12,12

     FORMAT 2:
     SIZE 32.5 mm, 18 mm

     QRCODE:
     224,84,L,3,A,180,M2,S7

     TEXT:
     234,120,"0",180,10,9
     136,85,"0",180,9,9
     136,48,"0",180,9,9
  ======================================================= */

  const PRINT_CONFIGS = {
    THERMAL_47_5X25: {
      width: 47.5,
      height: 25,

      /*
       * QR LEFT
       */
      qrLeft: 3.0,
      qrTop: 4.0,
      qrSize: 14.8,

      /*
       * TEXT RIGHT
       */
      textLeft: 19.0,
      textTop: 4.0,
      textWidth: 26.0,

      titleFont: 8.6,
      subFont: 7.5,
      codeFont: 7.5,

      titleTop: 4.0,
      subTop: 10.0,
      codeTop: 14.3,
    },

THERMAL_32_5X18: {
  width: 32.5,
  height: 18,

  /* QR */
  qrLeft: 1.5,
  qrTop: 6.9,
  qrSize: 11.1,

  /* TEXT */
  textLeft: 14.2,
  textTop: 7.1,
  textWidth: 16.5,

  /* TEXT SIZE */
  titleFont: 6.2,
  subFont: 5.6,
  codeFont: 5.6,

  /* TEXT */
  titleTop: 7.1,
  subTop: 11.6,
  codeTop: 14.8,
},
  };


  const currentPrintConfig =
    PRINT_CONFIGS[
      printLayout
    ] ||
    PRINT_CONFIGS
      .THERMAL_32_5X18;


  /* =======================================================
     HTML ESCAPE
  ======================================================= */

  const escapeHtml = (
    value
  ) => {
    return String(
      value ?? ""
    )
      .replace(
        /&/g,
        "&amp;"
      )
      .replace(
        /</g,
        "&lt;"
      )
      .replace(
        />/g,
        "&gt;"
      )
      .replace(
        /"/g,
        "&quot;"
      )
      .replace(
        /'/g,
        "&#039;"
      );
  };


  /* =======================================================
     CREATE PRINT QR
     
     QR PAYLOAD:
     FIRESTORE PRODUCT ID ONLY
  ======================================================= */
const createPrintQR = async (productId) => {
  if (!productId) {
    return "";
  }

  try {
    const svg = await QRCode.toString(
      String(productId),
      {
        type: "svg",
        errorCorrectionLevel: "L",
        margin: 0,
        color: {
          dark: "#000000",
          light: "#ffffff",
        },
      }
    );

    const parser = new DOMParser();

    const parsed =
      parser.parseFromString(
        svg,
        "image/svg+xml"
      );

    const svgElement =
      parsed.documentElement;

    /*
     * IMPORTANT:
     *
     * Keep the ORIGINAL QR SVG viewBox.
     *
     * Do NOT rebuild the QR using
     * viewBox="0 0 100 100".
     */

    svgElement.setAttribute(
      "class",
      "print-qr"
    );

    svgElement.setAttribute(
      "preserveAspectRatio",
      "xMidYMid meet"
    );

    svgElement.setAttribute(
      "aria-hidden",
      "true"
    );

    /*
     * Remove generated physical dimensions.
     * CSS will control the exact mm size.
     */

    svgElement.removeAttribute(
      "width"
    );

    svgElement.removeAttribute(
      "height"
    );

    return svgElement.outerHTML;

  } catch (error) {

    console.error(
      "Print QR generation failed:",
      error
    );

    return "";
  }
};


  /* =======================================================
     BUILD ONE PRINT LABEL
  ======================================================= */

  const buildPrintLabel =
    async (
      product,
      config
    ) => {
      /*
       * VERY IMPORTANT:
       *
       * QR VALUE = PRODUCT ID ONLY
       */
      const productId =
        String(
          product?.id || ""
        ).trim();

      if (!productId) {
        return "";
      }

      const productName =
        String(
          product?.productName ||
          product?.name ||
          ""
        );

      const subcollection =
        String(
          selectedSubcollectionName ||
          ""
        );

      const productCode =
        String(
          product?.productCode ||
          ""
        );

      const qr =
        await createPrintQR(
          productId
        );

      return `
        <div
          class="print-label"
          data-product-id="${escapeHtml(
            productId
          )}"
        >

          <!-- ============================
               QR
          ============================= -->

         ${qr}


          <!-- ============================
               PRODUCT NAME
          ============================= -->

          <div class="print-product-name">
            ${escapeHtml(
              productName
            )}
          </div>


          <!-- ============================
               SUBCOLLECTION
          ============================= -->

          <div class="print-subcollection">
            ${escapeHtml(
              subcollection
            )}
          </div>


          <!-- ============================
               PRODUCT CODE
          ============================= -->

          <div class="print-product-code">
            Code:
            ${escapeHtml(
              productCode
            )}
          </div>

        </div>
      `;
    };


  /* =======================================================
     PRINT
  ======================================================= */

  const handlePrint =
    async () => {
      if (
        printableProducts.length ===
        0
      ) {
        alert(
          "Please select at least one product."
        );

        return;
      }

      const config =
        currentPrintConfig;

      /*
       * Open popup immediately.
       */
      const printWindow =
        window.open(
          "",
          "_blank",
          "width=700,height=900"
        );

      if (!printWindow) {
        alert(
          "Please allow pop-ups for printing."
        );

        return;
      }


      /* =====================================================
         GENERATE LABELS
      ===================================================== */

      const labels = [];

      for (
        const product of printableProducts
      ) {
        const html =
          await buildPrintLabel(
            product,
            config
          );

        if (html) {
          labels.push(html);
        }
      }

      const labelsHTML =
        labels.join("");


      /* =====================================================
         PRINT WINDOW
      ===================================================== */

      printWindow.document.open();

      printWindow.document.write(`
        <!DOCTYPE html>

        <html>

          <head>

            <meta
              charset="UTF-8"
            />

            <meta
              name="viewport"
              content="width=device-width, initial-scale=1"
            />

            <title>
              QR Labels
            </title>


            <style>

              /* =================================================
                 EXACT PAGE SIZE
              ================================================= */

              @page {

                size:
                  ${config.width}mm
                  ${config.height}mm;

                margin:
                  0 !important;

              }


              /* =================================================
                 GLOBAL RESET
              ================================================= */

              *,
              *::before,
              *::after {

                box-sizing:
                  border-box !important;

              }


              html {

                width:
                  ${config.width}mm !important;

                min-width:
                  ${config.width}mm !important;

                max-width:
                  ${config.width}mm !important;

                height:
                  ${config.height}mm !important;

                margin:
                  0 !important;

                padding:
                  0 !important;

              }


              body {

                width:
                  ${config.width}mm !important;

                min-width:
                  ${config.width}mm !important;

                max-width:
                  ${config.width}mm !important;

                height:
                  ${config.height}mm !important;

                margin:
                  0 !important;

                padding:
                  0 !important;

                background:
                  #ffffff !important;

                font-family:
                  Arial,
                  Helvetica,
                  sans-serif !important;

                overflow:
                  hidden !important;

              }


              /* =================================================
                 ONE LABEL
              ================================================= */

              .print-label {

                position:
                  relative !important;

                width:
                  ${config.width}mm !important;

                min-width:
                  ${config.width}mm !important;

                max-width:
                  ${config.width}mm !important;

                height:
                  ${config.height}mm !important;

                min-height:
                  ${config.height}mm !important;

                max-height:
                  ${config.height}mm !important;

                margin:
                  0 !important;

                padding:
                  0 !important;

                background:
                  #ffffff !important;

                overflow:
                  hidden !important;

                page-break-after:
                  always !important;

                break-after:
                  page !important;

                transform:
                  none !important;

              }


              .print-label:last-child {

                page-break-after:
                  auto !important;

                break-after:
                  auto !important;

              }


              /* =================================================
                 QR CODE

                 47.5 × 25:
                 LEFT = 3mm
                 TOP  = 4mm
                 SIZE = 14.8mm

                 32.5 × 18:
                 LEFT = 1.8mm
                 TOP  = 3mm
                 SIZE = 10.5mm
              ================================================= */

              .print-qr {

  position:
    absolute !important;

  left:
    ${config.qrLeft}mm !important;

  top:
    ${config.qrTop}mm !important;

  width:
    ${config.qrSize}mm !important;

  height:
    ${config.qrSize}mm !important;

  min-width:
    ${config.qrSize}mm !important;

  min-height:
    ${config.qrSize}mm !important;

  max-width:
    ${config.qrSize}mm !important;

  max-height:
    ${config.qrSize}mm !important;

  display:
    block !important;

  margin:
    0 !important;

  padding:
    0 !important;

  overflow:
    visible !important;

  transform:
    none !important;

  transform-origin:
    center center !important;

  shape-rendering:
    crispEdges !important;
}

              .print-qr rect,
              .print-qr path {

                shape-rendering:
                  crispEdges !important;

              }


              /* =================================================
                 PRODUCT NAME

                 NO ROTATION.

                 Your physical PRN output is upright, so
                 rotating the HTML by 180 degrees is incorrect.
              ================================================= */

              .print-product-name {

                position:
                  absolute !important;

                left:
                  ${config.textLeft}mm !important;

                top:
                  ${config.titleTop}mm !important;

                width:
                  ${config.textWidth}mm !important;

                height:
                  4mm !important;

                margin:
                  0 !important;

                padding:
                  0 !important;

                text-align:
                  left !important;

                font-family:
                  Arial,
                  Helvetica,
                  sans-serif !important;

                font-size:
                  ${config.titleFont}pt !important;

                font-weight:
                  bold !important;

                line-height:
                  1 !important;

                white-space:
                  nowrap !important;

                overflow:
                  hidden !important;

                text-overflow:
                  ellipsis !important;

                transform:
                  none !important;

              }


              /* =================================================
                 SUBCOLLECTION
              ================================================= */

              .print-subcollection {

                position:
                  absolute !important;

                left:
                  ${config.textLeft}mm !important;

                top:
                  ${config.subTop}mm !important;

                width:
                  ${config.textWidth}mm !important;

                height:
                  3.5mm !important;

                margin:
                  0 !important;

                padding:
                  0 !important;

                text-align:
                  left !important;

                font-family:
                  Arial,
                  Helvetica,
                  sans-serif !important;

                font-size:
                  ${config.subFont}pt !important;

                font-weight:
                  normal !important;

                line-height:
                  1 !important;

                white-space:
                  nowrap !important;

                overflow:
                  hidden !important;

                text-overflow:
                  ellipsis !important;

                transform:
                  none !important;

              }


              /* =================================================
                 PRODUCT CODE
              ================================================= */

              .print-product-code {

                position:
                  absolute !important;

                left:
                  ${config.textLeft}mm !important;

                top:
                  ${config.codeTop}mm !important;

                width:
                  ${config.textWidth}mm !important;

                height:
                  4mm !important;

                margin:
                  0 !important;

                padding:
                  0 !important;

                text-align:
                  left !important;

                font-family:
                  Arial,
                  Helvetica,
                  sans-serif !important;

                font-size:
                  ${config.codeFont}pt !important;

                font-weight:
                  normal !important;

                line-height:
                  1 !important;

                white-space:
                  nowrap !important;

                overflow:
                  hidden !important;

                text-overflow:
                  ellipsis !important;

                transform:
                  none !important;

              }


              /* =================================================
                 PRINT MEDIA
              ================================================= */

              @media print {

                @page {

                  size:
                    ${config.width}mm
                    ${config.height}mm !important;

                  margin:
                    0 !important;

                }


                html,
                body {

                  width:
                    ${config.width}mm !important;

                  height:
                    ${config.height}mm !important;

                  margin:
                    0 !important;

                  padding:
                    0 !important;

                }


                .print-label {

                  width:
                    ${config.width}mm !important;

                  height:
                    ${config.height}mm !important;

                  margin:
                    0 !important;

                  padding:
                    0 !important;

                }


                /*
                 * Prevent browser from adding
                 * any unwanted scaling.
                 */

                .print-qr,
                .print-product-name,
                .print-subcollection,
                .print-product-code {

                  print-color-adjust:
                    exact !important;

                  -webkit-print-color-adjust:
                    exact !important;

                }

              }

            </style>

          </head>


          <body>

            ${labelsHTML}

          </body>

        </html>
      `);

      printWindow.document.close();


      /* =====================================================
         WAIT FOR QR + DOM
      ===================================================== */

      const waitForPrint =
        () => {

          try {

            printWindow.focus();

            printWindow.print();

          } catch (error) {

            console.error(
              "Printing failed:",
              error
            );

          }

        };


      /*
       * Give Chrome enough time to
       * finish rendering all SVG QR codes.
       */
      setTimeout(
        waitForPrint,
        900
      );


      printWindow.onafterprint =
        () => {

          setTimeout(
            () => {

              try {
                printWindow.close();
              } catch (error) {
                console.error(
                  error
                );
              }

            },
            300
          );

        };
    };


  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="admin-page">

      {/* =================================================
          TITLE
      ================================================= */}

      <div className="product-title">

        <h1>
          Barcode / QR Printing
        </h1>

      </div>


      {/* =================================================
          COLLECTION
      ================================================= */}

      <div className="form-group">

        <label>
          Collection
        </label>

        <select
          value={
            selectedCollectionId
          }
          onChange={(e) => {

            setSelectedCollectionId(
              e.target.value
            );

            setSelectedSubcollectionId(
              ""
            );

            setProducts([]);

            setSelectedProductIds([]);

            setProductQuantities({});

          }}
        >

          <option value="">
            Select Collection
          </option>

          {collections.map(
            (collectionItem) => (

              <option
                key={
                  collectionItem.id
                }
                value={
                  collectionItem.id
                }
              >

                {
                  collectionItem.title ||
                  collectionItem.name ||
                  collectionItem.id
                }

              </option>

            )
          )}

        </select>

      </div>


      {/* =================================================
          SUBCOLLECTION
      ================================================= */}

      <div className="form-group">

        <label>
          Subcollection
        </label>

        <select
          value={
            selectedSubcollectionId
          }
          disabled={
            !selectedCollectionId
          }
          onChange={(e) => {

            setSelectedSubcollectionId(
              e.target.value
            );

            setSelectedProductIds([]);

            setProductQuantities({});

          }}
        >

          <option value="">
            Select Subcollection
          </option>

          {subcollections.map(
            (subcollection) => (

              <option
                key={
                  subcollection.id
                }
                value={
                  subcollection.id
                }
              >

                {
                  subcollection.name ||
                  subcollection.title ||
                  subcollection.id
                }

              </option>

            )
          )}

        </select>

      </div>


      {/* =================================================
          PRODUCTS
      ================================================= */}

      <div className="admin-section">

        <h3>
          Products
        </h3>


        <div className="product-actions-bar">

          <button
            type="button"
            onClick={
              selectAllProducts
            }
            disabled={
              products.length === 0
            }
          >
            Select All
          </button>


          <button
            type="button"
            onClick={
              clearAllProducts
            }
            disabled={
              selectedProductIds.length ===
              0
            }
          >
            Clear All
          </button>


          <span className="selected-count">

            Selected:{" "}

            {
              selectedProductIds.length
            }

          </span>


          <span className="selected-count">

            Labels:{" "}

            {totalLabelCount}

          </span>

        </div>


        <div className="product-grid">

          {products.length === 0 && (

            <div
              style={{
                padding: "20px",
                color: "#6b7280",
              }}
            >

              {
                selectedSubcollectionId
                  ? "No products found."
                  : "Select a subcollection first."
              }

            </div>

          )}


          {products.map(
            (product) => {

              const selected =
                selectedProductIds.includes(
                  product.id
                );

              const quantity =
                productQuantities[
                  product.id
                ] || 1;


              return (

                <div
                  key={
                    product.id
                  }

                  className={
                    `barcodeproduct-card ${
                      selected
                        ? "selected"
                        : ""
                    }`
                  }

                  onClick={() =>
                    toggleProduct(
                      product.id
                    )
                  }
                >

                  <input
                    type="checkbox"

                    checked={
                      selected
                    }

                    onChange={() =>
                      toggleProduct(
                        product.id
                      )
                    }

                    onClick={(e) =>
                      e.stopPropagation()
                    }
                  />


                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                    }}
                  >

                    <strong>

                      {
                        product.productName ||
                        product.name ||
                        "Unnamed Product"
                      }


                      {isNewProduct(
                        product
                      ) && (

                        <span className="new-badge">
                          NEW
                        </span>

                      )}

                    </strong>


                    <small>
                      {
                        selectedSubcollectionName
                      }
                    </small>


                    <small>

                      Code:{" "}

                      {
                        product.productCode ||
                        "-"
                      }

                    </small>


                    <small
                      style={{
                        display: "block",
                        marginTop: "4px",
                        color: "#9ca3af",
                        wordBreak:
                          "break-all",
                      }}
                    >

                      ID:{" "}

                      {
                        product.id
                      }

                    </small>


                    {selected && (

                      <div
                        style={{
                          display: "flex",
                          alignItems:
                            "center",
                          gap: "8px",
                          marginTop:
                            "10px",
                        }}
                      >

                        <span
                          style={{
                            fontSize:
                              "12px",
                            fontWeight:
                              "600",
                          }}
                        >
                          Quantity
                        </span>


                        <input
                          type="number"

                          min="1"

                          step="1"

                          value={
                            quantity
                          }

                          onClick={(e) =>
                            e.stopPropagation()
                          }

                          onChange={(e) => {

                            const value =
                              Math.max(
                                1,
                                parseInt(
                                  e.target.value,
                                  10
                                ) || 1
                              );

                            setProductQuantities(
                              (previous) => ({
                                ...previous,

                                [product.id]:
                                  value,
                              })
                            );

                          }}

                          style={{
                            width: "70px",
                            padding:
                              "5px 7px",
                            border:
                              "1px solid #d1d5db",
                            borderRadius:
                              "5px",
                          }}
                        />

                      </div>

                    )}

                  </div>

                </div>

              );

            }
          )}

        </div>

      </div>


      {/* =================================================
          PRINT FORMAT
      ================================================= */}

      <div className="admin-section">

        <h3>
          Print Format
        </h3>


        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "20px",
            alignItems: "center",
          }}
        >

          {/* ============================================
              47.5 × 25
          ============================================= */}

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "7px",
              cursor: "pointer",
            }}
          >

            <input
              type="radio"

              name="print-layout"

              value="THERMAL_47_5X25"

              checked={
                printLayout ===
                "THERMAL_47_5X25"
              }

              onChange={() =>
                setPrintLayout(
                  "THERMAL_47_5X25"
                )
              }
            />

            <span>
              47.5 × 25 mm
            </span>

          </label>


          {/* ============================================
              32.5 × 18
          ============================================= */}

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "7px",
              cursor: "pointer",
            }}
          >

            <input
              type="radio"

              name="print-layout"

              value="THERMAL_32_5X18"

              checked={
                printLayout ===
                "THERMAL_32_5X18"
              }

              onChange={() =>
                setPrintLayout(
                  "THERMAL_32_5X18"
                )
              }
            />

            <span>
              32.5 × 18 mm
            </span>

          </label>

        </div>


        {/* =============================================
            FORMAT INFORMATION
        ============================================== */}

        <div
          style={{
            marginTop: "14px",
            padding:
              "10px 12px",
            background:
              "#f3f4f6",
            borderRadius:
              "6px",
            fontSize: "13px",
            color: "#374151",
          }}
        >

          <strong>
            QR:
          </strong>{" "}

          Firestore Product ID only

          {" • "}

          Error correction: L

          {" • "}

          Physical orientation: upright

        </div>

      </div>


      {/* =================================================
          PRINT BUTTON
      ================================================= */}

      <button
        type="button"

        className="primary-btn"

        disabled={
          totalLabelCount === 0
        }

        onClick={
          handlePrint
        }
      >

        🖨️ Print QR Labels

        {totalLabelCount > 0 && (

          <>
            {" "}
            (
            {totalLabelCount}
            )
          </>

        )}

      </button>


      {/* =================================================
          SCREEN PREVIEW
      ================================================= */}

      <div
        ref={pdfRef}

        className={
          `print-area ${
            printLayout ===
            "THERMAL_47_5X25"
              ? "thermal-47-5-25"
              : "thermal-32-5-18"
          }`
        }
      >

        {printableProducts.map(
          (
            product,
            index
          ) => (

            <BarcodeLabel

              key={
                `${product.id}-${index}`
              }

              product={
                product
              }

              subcollectionName={
                selectedSubcollectionName
              }

              printLayout={
                printLayout
              }

            />

          )
        )}

      </div>

    </div>
  );
};


export default BarcodePrintingPage;