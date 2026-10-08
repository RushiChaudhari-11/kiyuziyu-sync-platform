import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faWhatsapp,faInstagram
} from "@fortawesome/free-brands-svg-icons";
import {
  faPhone,
  faCalendarCheck,
} from "@fortawesome/free-solid-svg-icons";

import { useNavigate } from "react-router-dom";
import "./FloatingContact.css";

const FloatingContact = () => {

  const navigate = useNavigate();

  const phone = "917897897441";
  const message =
    "Hello KiyuZiyu, I would like to enquire about your Jewellery.";

  return (
    <div className="bmm-float">

      {/* ================= WHATSAPP ================= */}
       <a
  href="https://www.instagram.com/kiyuziyu.in"
  target="_blank"
  rel="noopener noreferrer"
  className="bmm-float-icon instagram"
  aria-label="Instagram"
>
  <FontAwesomeIcon icon={faInstagram} />
</a>

      <a
        href={`https://wa.me/${phone}?text=${encodeURIComponent(message)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="bmm-float-icon whatsapp"
        aria-label="WhatsApp"
      >
        <FontAwesomeIcon icon={faWhatsapp} />
      </a>

      {/* ================= CALL ================= */}

      <a
        href="tel:+917897897441"
        className="bmm-float-icon call"
        aria-label="Call"
      >
        <FontAwesomeIcon icon={faPhone} />
      </a>

      {/* ================= BOOK APPOINTMENT ================= */}

     

    </div>
  );
};

export default FloatingContact;
