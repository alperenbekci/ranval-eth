import { useState, useEffect } from "react";
import { NFTStorage, File } from "nft.storage";
import { Buffer } from "buffer";
import { ethers } from "ethers";
import axios from "axios";
import Spinner from "react-bootstrap/Spinner";

import Navigation from "./components/Navigation";

// ABIs
import NFT from "./abis/NFT.json";

// Config
import config from "./config.json";

function App() {
  const [provider, setProvider] = useState(null);
  const [account, setAccount] = useState(null);
  const [nft, setNFT] = useState(null);
  const [isWalletConnected, setIsWalletConnected] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState(null);
  const [url, setURL] = useState(null);

  const [message, setMessage] = useState("");
  const [isWaiting, setIsWaiting] = useState(false);

  const loadBlockchainData = async () => {
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      setProvider(provider);

      const network = await provider.getNetwork();

      const nft = new ethers.Contract(
        config[network.chainId].nft.address,
        NFT,
        provider
      );
      setNFT(nft);

      // Check if the wallet is connected
      if (window.ethereum && window.ethereum.selectedAddress) {
        setAccount(window.ethereum.selectedAddress);
        setIsWalletConnected(true);
      } else {
        setIsWalletConnected(false);
      }
    } catch (error) {
      console.error("Error loading blockchain data:", error);
    }
  };

  const submitHandler = async (e) => {
    e.preventDefault();

    if (name === "" || description === "") {
      window.alert("Please provide a name and description");
      return;
    }

    setIsWaiting(true);

    // Call AI API to generate an image based on description
    const imageData = await createImage();

    // Upload image to IPFS (NFT.Storage)
    const url = await uploadImage(imageData);

    // Mint NFT
    await mintImage(url);

    setIsWaiting(false);
    setMessage("");
  };

  const createImage = async () => {
    setMessage("Generating Image...");

    // You can replace this with different model API's
    const URL = `https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-2`;

    // Send the request
    const response = await axios({
      url: URL,
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.REACT_APP_HUGGING_FACE_API_KEY}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      data: JSON.stringify({
        inputs: description,
        options: { wait_for_model: true },
      }),
      responseType: "arraybuffer",
    });

    const type = response.headers["content-type"];
    const data = response.data;

    const base64data = Buffer.from(data).toString("base64");
    const img = `data:${type};base64,` + base64data; // <-- This is so we can render it on the page
    setImage(img);

    return data;
  };

  const uploadImage = async (imageData) => {
    setMessage("Uploading Image...");

    // Create instance to NFT.Storage
    const nftstorage = new NFTStorage({
      token: process.env.REACT_APP_NFT_STORAGE_API_KEY,
    });

    // Send request to store image
    const { ipnft } = await nftstorage.store({
      image: new File([imageData], "image.jpeg", { type: "image/jpeg" }),
      name: name,
      description: description,
    });

    // Save the URL
    const url = `https://ipfs.io/ipfs/${ipnft}/metadata.json`;
    setURL(url);

    return url;
  };

  const mintImage = async (tokenURI) => {
    setMessage("Waiting for Mint...");

    const signer = await provider.getSigner();
    const transaction = await nft
      .connect(signer)
      .mint(tokenURI, { value: ethers.utils.parseUnits("1", "ether") });
    await transaction.wait();
  };

  useEffect(() => {
    loadBlockchainData();
  }, []);

  return (
    <div>
      {/* Conditionally render "Connect Wallet" message */}

      <Navigation account={account} setAccount={setAccount} />
      {!isWalletConnected && (
        <div className="form-container">
          <h2 className="form-header">RanVal.eth v1.0.1</h2>
          <form className="meta-form">
            <label htmlFor="title" className="form-label">
              <p>
                RanVal is a WEB3 service where users can generate their NFT's
                with Ranval AI and trade them with others via RanVal
                Marketplace.
              </p>
              <br></br>
              <p>
                It also assists users who want to determine the uniqueness of
                their ideas and whether they exist among existing projects.
              </p>
              <h2 className="form-header">RanVal Marketplace "coming soon"</h2>
            </label>
          </form>
          <h2 className="opensource">
            Please connect your wallet to get started ←
          </h2>
        </div>
      )}

      {/* Conditionally render the form if wallet is connected */}
      {isWalletConnected && (
        <div className="form-container">
          <div className="form">
            <form onSubmit={submitHandler}>
              <input
                type="text"
                placeholder="NFT Name..."
                onChange={(e) => {
                  setName(e.target.value);
                }}
              />
              <input
                type="text"
                placeholder="NFT Prompt..."
                onChange={(e) => setDescription(e.target.value)}
              />
              <input type="submit" value="Create & Mint" />
            </form>

            <div className="image">
              {!isWaiting && image ? (
                <img src={image} alt="AI generated" />
              ) : isWaiting ? (
                <div className="image__placeholder">
                  <Spinner animation="border" />
                  <p>{message}</p>
                </div>
              ) : (
                <></>
              )}
            </div>
          </div>
        </div>
      )}

      {!isWaiting && url && (
        <p>
          View&nbsp;
          <a href={url} target="_blank" rel="noreferrer">
            Metadata
          </a>
        </p>
      )}
      <footer className="footer">
        <p className="footerp">RanVal ETH & Marketplace</p>
        <a href="/">
          <span className="opensource">Go to the Marketplace👾</span>
        </a>
        <p className="footertag">powered by Team RanVal</p>
      </footer>
    </div>
  );
}

export default App;
