import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App";
import ConsentBanner from "./ConsentBanner";
import "./style.css";

// Lazy Load CategoryPage (wird nur bei Bedarf geladen)
const CategoryPage = lazy(() => import("./CategoryPage"));
const ArticleDetail = lazy(() => import("./ArticleDetail"));
const Chronik = lazy(() => import("./Chronik"));
const ArticlePage = lazy(() => import("./ArticlePage"));
const Datenschutz = lazy(() => import("./Datenschutz"));

// Fallback Loading Component
const LoadingFallback = () => (
  <div style={{ textAlign: "center", padding: "2em" }}>
    <p>Laden...</p>
  </div>
);

ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<App />} />
      <Route
        path="/datenschutz"
        element={
          <Suspense fallback={<LoadingFallback />}>
            <Datenschutz />
          </Suspense>
        }
      />
      <Route
        path="/artikel/:slug"
        element={
          <Suspense fallback={<LoadingFallback />}>
            <ArticlePage />
          </Suspense>
        }
      />
      <Route
        path="/chronik"
        element={
          <Suspense fallback={<LoadingFallback />}>
            <Chronik />
          </Suspense>
        }
      />
      <Route
        path="/category/:category"
        element={
          <Suspense fallback={<LoadingFallback />}>
            <CategoryPage />
          </Suspense>
        } 
      />
      <Route
        path="/category/:category/articles"
        element={
          <Suspense fallback={<LoadingFallback />}>
            <ArticleDetail />
          </Suspense>
        }
      />
    </Routes>
    <ConsentBanner />
  </BrowserRouter>
);
