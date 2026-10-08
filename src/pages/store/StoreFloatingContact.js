import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faWhatsapp,
  faInstagram
} from "@fortawesome/free-brands-svg-icons";
import {
  faPhone
} from "@fortawesome/free-solid-svg-icons";

import "../../components/FloatingContact.css";

const StoreFloatingContact = ({ data }) => {

  const phone = data?.phone || "";
  const whatsapp = data?.whatsapp || "";
  const instagram = data?.instagram || "";

  const message =
    "Hello KiyuZiyu, I would like to enquire about your Jewellery.";

  return (
    <div className="bmm-float">

      {/* INSTAGRAM */}
      {instagram && (
        <a
          href={instagram}
          target="_blank"
          rel="noopener noreferrer"
          className="bmm-float-icon instagram"
          aria-label="Instagram"
        >
          <FontAwesomeIcon icon={faInstagram} />
        </a>
      )}

      {/* WHATSAPP */}
      {whatsapp && (
        <a
          href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="bmm-float-icon whatsapp"
          aria-label="WhatsApp"
        >
          <FontAwesomeIcon icon={faWhatsapp} />
        </a>
      )}

      {/* CALL */}
      {phone && (
        <a
          href={`tel:${phone}`}
          className="bmm-float-icon call"
          aria-label="Call"
        >
          <FontAwesomeIcon icon={faPhone} />
        </a>
      )}

    </div>
  );
};

export default StoreFloatingContact;