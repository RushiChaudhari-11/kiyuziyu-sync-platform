import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  auth,
  db,
  doc,
  setDoc,
  getDoc,
  RecaptchaVerifier,
  signInAnonymously,
  // 👇 REQUIRED NEW FIRESTORE IMPORTS
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
} from '../firebase';
import '../styles/LoginPage.css';
import LogoImage from '../assets/logoj.png';
import { trackMetaEvent } from "../utils/pixels";
const countryCodes = [
  { code: "+91", name: "India" },
  { code: "+93", name: "Afghanistan" },
  { code: "+355", name: "Albania" },
  { code: "+213", name: "Algeria" },
  { code: "+1-684", name: "American Samoa" },
  { code: "+376", name: "Andorra" },
  { code: "+244", name: "Angola" },
  { code: "+1-264", name: "Anguilla" },
  { code: "+672", name: "Antarctica" },
  { code: "+1-268", name: "Antigua and Barbuda" },
  { code: "+54", name: "Argentina" },
  { code: "+374", name: "Armenia" },
  { code: "+297", name: "Aruba" },
  { code: "+61", name: "Australia" },
  { code: "+43", name: "Austria" },
  { code: "+994", name: "Azerbaijan" },
  { code: "+1-242", name: "Bahamas" },
  { code: "+973", name: "Bahrain" },
  { code: "+880", name: "Bangladesh" },
  { code: "+1-246", name: "Barbados" },
  { code: "+375", name: "Belarus" },
  { code: "+32", name: "Belgium" },
  { code: "+501", name: "Belize" },
  { code: "+229", name: "Benin" },
  { code: "+1-441", name: "Bermuda" },
  { code: "+975", name: "Bhutan" },
  { code: "+591", name: "Bolivia" },
  { code: "+387", name: "Bosnia and Herzegovina" },
  { code: "+267", name: "Botswana" },
  { code: "+55", name: "Brazil" },
  { code: "+246", name: "British Indian Ocean Territory" },
  { code: "+1-284", name: "British Virgin Islands" },
  { code: "+673", name: "Brunei" },
  { code: "+359", name: "Bulgaria" },
  { code: "+226", name: "Burkina Faso" },
  { code: "+257", name: "Burundi" },
  { code: "+855", name: "Cambodia" },
  { code: "+237", name: "Cameroon" },
  { code: "+1", name: "Canada" },
  { code: "+238", name: "Cape Verde" },
  { code: "+1-345", name: "Cayman Islands" },
  { code: "+236", name: "Central African Republic" },
  { code: "+235", name: "Chad" },
  { code: "+56", name: "Chile" },
  { code: "+86", name: "China" },
  { code: "+61-8", name: "Cocos (Keeling) Islands" },
  { code: "+61-8", name: "Christmas Island" },
  { code: "+57", name: "Colombia" },
  { code: "+269", name: "Comoros" },
  { code: "+242", name: "Republic of the Congo" },
  { code: "+243", name: "Democratic Republic of the Congo" },
  { code: "+682", name: "Cook Islands" },
  { code: "+506", name: "Costa Rica" },
  { code: "+225", name: "Côte d’Ivoire" },
  { code: "+385", name: "Croatia" },
  { code: "+53", name: "Cuba" },
  { code: "+357", name: "Cyprus" },
  { code: "+420", name: "Czech Republic" },
  { code: "+45", name: "Denmark" },
  { code: "+253", name: "Djibouti" },
  { code: "+1-767", name: "Dominica" },
  { code: "+1-809", name: "Dominican Republic" },
  { code: "+593", name: "Ecuador" },
  { code: "+20", name: "Egypt" },
  { code: "+503", name: "El Salvador" },
  { code: "+240", name: "Equatorial Guinea" },
  { code: "+291", name: "Eritrea" },
  { code: "+372", name: "Estonia" },
  { code: "+251", name: "Ethiopia" },
  { code: "+298", name: "Faroe Islands" },
  { code: "+500", name: "Falkland Islands" },
  { code: "+679", name: "Fiji" },
  { code: "+358", name: "Finland" },
  { code: "+33", name: "France" },
  { code: "+594", name: "French Guiana" },
  { code: "+689", name: "French Polynesia" },
  { code: "+241", name: "Gabon" },
  { code: "+220", name: "Gambia" },
  { code: "+995", name: "Georgia" },
  { code: "+49", name: "Germany" },
  { code: "+233", name: "Ghana" },
  { code: "+350", name: "Gibraltar" },
  { code: "+30", name: "Greece" },
  { code: "+1-473", name: "Grenada" },
  { code: "+590", name: "Guadeloupe" },
  { code: "+1-671", name: "Guam" },
  { code: "+502", name: "Guatemala" },
  { code: "+44-1481", name: "Guernsey" },
  { code: "+224", name: "Guinea" },
  { code: "+245", name: "Guinea-Bissau" },
  { code: "+592", name: "Guyana" },
  { code: "+509", name: "Haiti" },
  { code: "+504", name: "Honduras" },
  { code: "+36", name: "Hungary" },
  { code: "+354", name: "Iceland" },
  { code: "+91", name: "India" },
  { code: "+62", name: "Indonesia" },
  { code: "+98", name: "Iran" },
  { code: "+964", name: "Iraq" },
  { code: "+353", name: "Ireland" },
  { code: "+44-1624", name: "Isle of Man" },
  { code: "+972", name: "Israel" },
  { code: "+39", name: "Italy" },
  { code: "+1-876", name: "Jamaica" },
  { code: "+81", name: "Japan" },
  { code: "+44-1534", name: "Jersey" },
  { code: "+962", name: "Jordan" },
  { code: "+7", name: "Kazakhstan / Russia" },
  { code: "+254", name: "Kenya" },
  { code: "+686", name: "Kiribati" },
  { code: "+965", name: "Kuwait" },
  { code: "+996", name: "Kyrgyzstan" },
  { code: "+856", name: "Laos" },
  { code: "+371", name: "Latvia" },
  { code: "+961", name: "Lebanon" },
  { code: "+266", name: "Lesotho" },
  { code: "+231", name: "Liberia" },
  { code: "+218", name: "Libya" },
  { code: "+423", name: "Liechtenstein" },
  { code: "+370", name: "Lithuania" },
  { code: "+352", name: "Luxembourg" },
  { code: "+853", name: "Macau" },
  { code: "+389", name: "North Macedonia" },
  { code: "+261", name: "Madagascar" },
  { code: "+265", name: "Malawi" },
  { code: "+60", name: "Malaysia" },
  { code: "+960", name: "Maldives" },
  { code: "+223", name: "Mali" },
  { code: "+356", name: "Malta" },
  { code: "+692", name: "Marshall Islands" },
  { code: "+596", name: "Martinique" },
  { code: "+222", name: "Mauritania" },
  { code: "+230", name: "Mauritius" },
  { code: "+52", name: "Mexico" },
  { code: "+1-664", name: "Montserrat" },
  { code: "+212", name: "Morocco" },
  { code: "+95", name: "Myanmar" },
  { code: "+264", name: "Namibia" },
  { code: "+674", name: "Nauru" },
  { code: "+977", name: "Nepal" },
  { code: "+31", name: "Netherlands" },
  { code: "+687", name: "New Caledonia" },
  { code: "+64", name: "New Zealand" },
  { code: "+505", name: "Nicaragua" },
  { code: "+227", name: "Niger" },
  { code: "+234", name: "Nigeria" },
  { code: "+683", name: "Niue" },
  { code: "+672-3", name: "Norfolk Island" },
  { code: "+850", name: "North Korea" },
  { code: "+1-670", name: "Northern Mariana Islands" },
  { code: "+47", name: "Norway" },
  { code: "+968", name: "Oman" },
  { code: "+92", name: "Pakistan" },
  { code: "+680", name: "Palau" },
  { code: "+970", name: "Palestine" },
  { code: "+507", name: "Panama" },
  { code: "+675", name: "Papua New Guinea" },
  { code: "+595", name: "Paraguay" },
  { code: "+51", name: "Peru" },
  { code: "+63", name: "Philippines" },
  { code: "+48", name: "Poland" },
  { code: "+351", name: "Portugal" },
  { code: "+1-787", name: "Puerto Rico" },
  { code: "+974", name: "Qatar" },
  { code: "+262", name: "Réunion" },
  { code: "+40", name: "Romania" },
  { code: "+7", name: "Russia" },
  { code: "+250", name: "Rwanda" },
  { code: "+590", name: "Saint Barthélemy" },
  { code: "+290", name: "Saint Helena" },
  { code: "+1-869", name: "Saint Kitts & Nevis" },
  { code: "+1-758", name: "Saint Lucia" },
  { code: "+590", name: "Saint Martin" },
  { code: "+1-784", name: "Saint Vincent & the Grenadines" },
  { code: "+685", name: "Samoa" },
  { code: "+378", name: "San Marino" },
  { code: "+239", name: "São Tomé & Príncipe" },
  { code: "+966", name: "Saudi Arabia" },
  { code: "+221", name: "Senegal" },
  { code: "+381", name: "Serbia" },
  { code: "+248", name: "Seychelles" },
  { code: "+232", name: "Sierra Leone" },
  { code: "+65", name: "Singapore" },
  { code: "+421", name: "Slovakia" },
  { code: "+386", name: "Slovenia" },
  { code: "+677", name: "Solomon Islands" },
  { code: "+252", name: "Somalia" },
  { code: "+27", name: "South Africa" },
  { code: "+500", name: "South Georgia & South Sandwich Islands" },
  { code: "+82", name: "South Korea" },
  { code: "+211", name: "South Sudan" },
  { code: "+34", name: "Spain" },
  { code: "+94", name: "Sri Lanka" },
  { code: "+1-869", name: "St Kitts & Nevis" },
  { code: "+590", name: "St Martin" },
  { code: "+1-784", name: "St Vincent & Grenadines" },
  { code: "+597", name: "Suriname" },
  { code: "+47-21", name: "Svalbard & Jan Mayen" },
  { code: "+268", name: "Eswatini" },
  { code: "+46", name: "Sweden" },
  { code: "+41", name: "Switzerland" },
  { code: "+963", name: "Syria" },
  { code: "+886", name: "Taiwan" },
  { code: "+992", name: "Tajikistan" },
  { code: "+255", name: "Tanzania" },
  { code: "+66", name: "Thailand" },
  { code: "+670", name: "Timor-Leste" },
  { code: "+228", name: "Togo" },
  { code: "+690", name: "Tokelau" },
  { code: "+676", name: "Tonga" },
  { code: "+1-868", name: "Trinidad & Tobago" },
  { code: "+216", name: "Tunisia" },
  { code: "+90", name: "Turkey" },
  { code: "+993", name: "Turkmenistan" },
  { code: "+1-649", name: "Turks & Caicos Islands" },
  { code: "+688", name: "Tuvalu" },
  { code: "+256", name: "Uganda" },
  { code: "+380", name: "Ukraine" },
  { code: "+971", name: "United Arab Emirates" },
  { code: "+44", name: "United Kingdom" },
  { code: "+1", name: "United States" },
  { code: "+1-787", name: "US Puerto Rico" },
  { code: "+1-939", name: "US Virgin Islands" },
  { code: "+598", name: "Uruguay" },
  { code: "+998", name: "Uzbekistan" },
  { code: "+678", name: "Vanuatu" },
  { code: "+379", name: "Vatican City" },
  { code: "+39-06", name: "Vatican City" },
  { code: "+58", name: "Venezuela" },
  { code: "+84", name: "Vietnam" },
  { code: "+681", name: "Wallis & Futuna" },
  { code: "+212", name: "Western Sahara" },
  { code: "+967", name: "Yemen" },
  { code: "+260", name: "Zambia" },
  { code: "+263", name: "Zimbabwe" }
];


const FIREBASE_FUNCTION_URL = "https://us-central1-jewellerywholesale-2e57c.cloudfunctions.net/sendWhatsappOtp";

const LoginPage = () => {
  const [countryCode, setCountryCode] = useState('+91');
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState(null);
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [isOtpVerified, setIsOtpVerified] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // States for Profile Setup
  const [userName, setUserName] = useState('');
  const [userAddress, setUserAddress] = useState('');
  const [userCountry, setUserCountry] = useState(countryCodes[0].name);

  const navigate = useNavigate();

  // State to hold the user object after anonymous sign-in, before profile is created
  const [tempUser, setTempUser] = useState(null);

  useEffect(() => {
    // Initialize the invisible reCAPTCHA verifier
    window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
      'size': 'invisible',
    });
  }, []);

  const generateRandomOtp = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setIsProcessing(true);

    if (!mobile) {
      setError('Please enter your mobile number.');
      setIsProcessing(false);
      return;
    }

    const fullMobileNumber = `${countryCode}${mobile}`;
    const otpValue = generateRandomOtp();

    try {
      setGeneratedOtp(otpValue);
      setInfo(`Sending OTP to ${fullMobileNumber}...`);

      const myHeaders = new Headers();
      myHeaders.append("Content-Type", "application/json");

      const raw = JSON.stringify({
        "integrated_number": "15558299861",
        "content_type": "template",
        "payload": {
          "messaging_product": "whatsapp",
          "type": "template",
          "template": {
            "name": "kiyuotp",
            "language": { "code": "en", "policy": "deterministic" },
            "namespace": "60cbb046_c34d_4f04_8c62_2cb720ccf00d",
            "to_and_components": [{
              "to": [fullMobileNumber.replace('+', '')],
              "components": {
                "body_1": { "type": "text", "value": otpValue },
                "button_1": {
                  "subtype": "url",
                  "type": "text",
                  "value": otpValue
                }
              }
            }]
          }
        }
      });

      const requestOptions = {
        method: 'POST',
        headers: myHeaders,
        body: raw,
        redirect: 'follow'
      };

      const response = await fetch(FIREBASE_FUNCTION_URL, requestOptions);
      const result = await response.json();

      if (response.ok && result.status === "success") {
        setIsOtpSent(true);

trackMetaEvent("Lead", {
  method: "WhatsApp OTP"
});

setInfo('OTP sent successfully. Please check your WhatsApp.');
      } else {
        setError(result.message || 'Failed to send OTP. Please check server logs.');
        console.error('API Error:', result);
      }
    } catch (err) {
      console.error('Error sending OTP:', err);
      setError('Failed to send OTP. Network error or function not accessible.');
    } finally {
      setIsProcessing(false);
    }
  };

  // 👇 CORRECTED: handleVerifyOtp function checks for profile existence via mobile number
  // src/pages/LoginPage.jsx

  // ... (inside the LoginPage component)

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setIsProcessing(true);

    if (otp !== generatedOtp) {
      setError('Invalid OTP. Please try again.');
      setIsProcessing(false);
      return;
    }

    try {
      setInfo('OTP verified! Checking user status and logging in...');

      const fullMobileNumber = `${countryCode}${mobile}`;

      // 1. Check if a profile with this mobile number already exists in Firestore
      const usersCollectionRef = collection(db, 'users');
      const q = query(usersCollectionRef, where("mobile", "==", fullMobileNumber));
      const querySnapshot = await getDocs(q);

      // 2. Sign the user into a *new* anonymous session
      const userCredential = await signInAnonymously(auth);
      const firebaseUser = userCredential.user;
      setTempUser(firebaseUser);

      if (!querySnapshot.empty) {
        // --- RETURNING USER (LOGIN) - MIGRATION LOGIC ---
        const existingDoc = querySnapshot.docs[0];
        const oldDocId = existingDoc.id;
        const oldDocData = existingDoc.data();

        // This is the fix: We create a NEW document where the Doc ID == new UID
        const newDocRef = doc(db, 'users', firebaseUser.uid);
        await setDoc(newDocRef, {
          ...oldDocData, // Copy all existing user data (name, address, role, etc.)
          uid: firebaseUser.uid, // Ensure the uid field is the new one
          lastLogin: new Date(),
        });

        // Delete the OLD document (only if the IDs are different)
        if (oldDocId !== firebaseUser.uid) {
          const oldDocRef = doc(db, 'users', oldDocId);
          await deleteDoc(oldDocRef);
          console.log(`Migrated profile from old Doc ID (${oldDocId}) to new UID Doc ID (${firebaseUser.uid}).`);
        }

        setInfo('Welcome back! Logging in...');

trackMetaEvent("Login", {
  method: "WhatsApp OTP"
});

navigate('/');

      } else {
        // --- NEW USER (SIGN UP) ---
        setInfo('Verified! Now, please complete your profile.');

        // Create the initial minimal document using the new anonymous UID (Doc ID == UID)
        const newUserRef = doc(db, 'users', firebaseUser.uid);
        await setDoc(newUserRef, {
          uid: firebaseUser.uid,
          mobile: fullMobileNumber,
          role: 'wholesaler',
          createdAt: new Date(),
        });

        setIsOtpVerified(true); // Move to profile setup screen
      }

    } catch (err) {
      console.error('Error during login/sign-up:', err);
      setError('An error occurred during sign-in. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // 👇 handleProfileSetup function (unchanged from the working version)
  const handleProfileSetup = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setIsProcessing(true);

    if (!userName || !userAddress || !userCountry) {
      setError('All profile fields are required.');
      setIsProcessing(false);
      return;
    }

    if (!tempUser) {
      setError('Authentication session lost. Please restart the process.');
      setIsProcessing(false);
      return;
    }

    try {
      setInfo('Saving profile...');
      // Use the UID from the anonymous session
      const userRef = doc(db, 'users', tempUser.uid);

      // Update the existing document with full profile details
      await setDoc(userRef, {
        name: userName,
        country: userCountry,
        address: userAddress,
      }, { merge: true });

      setInfo('Sign up successful! Redirecting...');

trackMetaEvent("CompleteRegistration", {
  status: "Success"
});

setTimeout(() => navigate('/'), 1000);

    } catch (err) {
      console.error('Error during profile setup:', err);
      setError('An error occurred while saving your profile. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }
  // --- Helpers for formatting and matching ---
  const formatLabel = (cc) => `${cc.name} (${cc.code})`;

  const findCountryByInput = (input) => {
    const i = input.trim().toLowerCase();
    return countryCodes.find((cc) =>
      formatLabel(cc).toLowerCase() === i ||
      cc.name.toLowerCase() === i ||
      cc.code.replace(/\s/g, '') === i.replace(/\s/g, '')
    );
  };

  // --- Local search text states for the autocompletes ---
  const [countrySearch, setCountrySearch] = useState(() => {
    // initialize with current selected code
    const current = countryCodes.find((c) => c.code === countryCode);
    return current ? formatLabel(current) : "";
  });

  const [profileCountrySearch, setProfileCountrySearch] = useState(() => {
    const current = countryCodes.find((c) => c.name === userCountry);
    return current ? current.name : "";
  });

  // keep search boxes in sync if external state changes
  useEffect(() => {
    const current = countryCodes.find((c) => c.code === countryCode);
    if (current) setCountrySearch(formatLabel(current));
  }, [countryCode]);

  useEffect(() => {
    const current = countryCodes.find((c) => c.name === userCountry);
    if (current) setProfileCountrySearch(current.name);
  }, [userCountry]);

  // 👇 renderForm function (unchanged from the working version)
  const renderForm = () => {
    if (!isOtpSent) {
      // Form to get mobile number and send OTP
      return (
        <form onSubmit={handleSendOtp}>
          <h2>Login or Sign Up</h2>
          <div className="form-group">
    <label htmlFor="country-code">Country</label>
    <input
        id="country-code"
        list="country-code-list"
        value={countrySearch}
        onChange={(e) => {
            const val = e.target.value;
            setCountrySearch(val);
            const match = findCountryByInput(val);
            if (match) setCountryCode(match.code);
        }}
        placeholder="Type country name or code (e.g., India or +91)"
        disabled={isProcessing}
        className="input"
    />

    <datalist id="country-code-list">
        {countryCodes.map((cc) => (
            <option key={cc.code} value={formatLabel(cc)} />
        ))}
    </datalist>

    <small className="hint">
        Selected code: <strong>{countryCode}</strong>
    </small>

</div>
          <div className="form-group">
            <label htmlFor="mobile">Mobile Number</label>
            <input
              type="tel"
              id="mobile"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              placeholder="Enter mobile number"
              required
              disabled={isProcessing}
            />
          </div>
          <button type="submit" className="login-button" disabled={isProcessing}>
            {isProcessing ? 'Sending OTP...' : 'Send OTP'}
          </button>
        </form>
      );
    } else if (isOtpSent && !isOtpVerified) {
      // Form to verify OTP
      return (
        <form onSubmit={handleVerifyOtp}>
          <h2>Verify OTP</h2>
          <p>An OTP has been sent to {mobile}. Please enter it below.</p>
          <div className="form-group">
            <label htmlFor="otp">OTP</label>
            <input
              type="text"
              id="otp"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder="Enter 6-digit OTP"
              required
              disabled={isProcessing}
            />
          </div>
          <button type="submit" className="login-button" disabled={isProcessing}>
            {isProcessing ? 'Verifying...' : 'Verify & Proceed'}
          </button>
        </form>
      );
    } else {
      // Profile Setup Form
      return (
        <form onSubmit={handleProfileSetup}>
          <h2>Complete Your Profile</h2>
          <p>One final step to get started!</p>
          <div className="form-group">
            <label htmlFor="name">Full Name</label>
            <input
              type="text"
              id="name"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="Your full name"
              required
              disabled={isProcessing}
            />
          </div>
          <div className="form-group">
            <label htmlFor="address">Address</label>
            <input
              type="text"
              id="address"
              value={userAddress}
              onChange={(e) => setUserAddress(e.target.value)}
              placeholder="Your full address"
              required
              disabled={isProcessing}
            />
          </div>
          <div className="form-group">
            <label htmlFor="profile-country">Country</label>
            <input
              id="profile-country"
              list="profile-country-list"
              value={profileCountrySearch}
              onChange={(e) => {
                const val = e.target.value;
                setProfileCountrySearch(val);
                const match = findCountryByInput(val);
                if (match) setUserCountry(match.name);
              }}
              placeholder="Start typing your country"
              disabled={isProcessing}
              className="input"
            />

            <datalist id="profile-country-list">
              {countryCodes.map((cc) => (
                <option key={cc.code} value={cc.name} />
              ))}
            </datalist>

          </div>
          <button type="submit" className="login-button" disabled={isProcessing}>
            {isProcessing ? 'Saving...' : 'Finish Sign Up & Login'}
          </button>
        </form>
      );
    }
  };

  return (
    <div className="login-page-container">
      <div className="login-image-section">
        {/* 👇 REPLACE THIS DIV CONTENT */}
        
        {/* 👆 WITH THIS */}

      </div>
      <div className="login-form-section">
        <div className="login-container">
          <h1>Welcome</h1>
          {error && <p className="error-message">{error}</p>}
          {info && <p className="info-message">{info}</p>}

          {renderForm()}

          <div id="recaptcha-container"></div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;