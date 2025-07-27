# GeoJSON Fusion Tool

A sophisticated web application designed to analyze, configure, and merge two GeoJSON datasets. While generic, it is highly optimized for combining country and administrative boundary data from sources like [Natural Earth](https://www.naturalearthdata.com/).

The tool allows for granular control over how features and their properties are combined, with separate rules for recognized sovereign states and dependent territories. It provides detailed analysis, a side-by-side comparison interface, and powerful tools for resolving data conflicts and enriching translations.

---
<img width="692" height="920" alt="image" src="https://github.com/user-attachments/assets/a8ca2a62-073c-41f8-b1dc-a620b9a69441" />


## ✨ Features

*   **File Loading & Analysis**:
    *   Dynamically loads available GeoJSON files from a manifest.
    *   Performs in-depth analysis on selected files, showing feature count, common properties, detected languages (from `name_xx` properties), and geometry complexity.
    *   Automatically identifies potential properties to use for matching features across files (e.g., `iso_a3`, `admin`).

*   **Intelligent Territory Analysis**:
    *   Heuristically determines the primary name and sovereignty properties within each file.
    *   Distinguishes between sovereign states and dependent territories to apply different merge rules.

*   **Interactive Comparison & Selection**:
    *   A powerful comparison table lists all unique territories from both files.
    *   Users can see which file contains which territory and manually select the definitive source for each: **File A**, **File B**, or **Discard**.
    *   Features advanced sorting (including by sovereign group) and filtering.
    *   Bulk-selection tools for quickly setting preferences.

*   **Granular Merge Configuration**:
    *   **Separate rules** for recognized sovereign states and dependent territories.
    *   **Translations & Core IDs**: Control the source for `name`, `name_xx`, `admin`, etc. properties.
    *   **Other Properties**: Control the source for all other data (population, GDP, etc.).
    *   **Additive Merge**: Option to include unique properties from the non-primary source file.
    *   **Individual Property Selection**: Fine-grained control to include or exclude specific "other" properties from the final output.

*   **Manual Data Enrichment**:
    *   A dedicated panel for manually inputting or correcting translations and core ID fields for any feature.
    *   Inputs are color-coded to show their status (manually entered, exists in source, or missing).
    *   Manual entries always take the highest precedence in the final merge.

*   **Automated Translation (CLDR)**:
    *   One-click functionality to fetch and apply official territory translations from the Unicode CLDR (Common Locale Data Repository) for ~30 common languages.
    *   Intelligently fills in only missing translation fields, respecting existing source data and manual overrides.

*   **Output Optimization & Management**:
    *   Set the desired coordinate precision (number of decimal places) for the output file to reduce file size.
    *   Save your entire configuration (merge rules, selections, manual translations) to a JSON file.
    *   Load a saved configuration file to instantly restore a previous session.

*   **Purely Frontend**: Runs entirely in the browser. No server-side processing needed.

---

## 🚀 How to Use

1.  **Prepare Data**: Place your GeoJSON files in the `public/data/` directory.
2.  **Update Manifest**: Add your files to `public/data/manifest.json`. The structure for each entry is `{ "key": "unique-key", "name": "Display Name", "path": "/data/your-file.geojson" }`.
3.  **Select Files**: Using the dropdowns in **Section 1**, select the two GeoJSON files you want to merge. The app will automatically suggest a common ID property for matching.
4.  **Analyze**: Review the analysis cards in **Section 2** to understand the contents of your files.
5.  **Review & Select (Optional but Recommended)**: In **Section 2.5**, use the comparison table to resolve any discrepancies. For each territory, choose whether to keep the version from File A, File B, or discard it entirely from the merge.
6.  **Manual Translations (Optional)**: In **Section 2.75**, fill in any missing or incorrect name translations. You can also use the "Apply CLDR Translations" button for automatic enrichment.
7.  **Configure Merge Strategy**: In **Section 3**, define the rules for the merge. For both sovereign states and dependent territories, decide:
    *   The primary source for name/translation properties.
    *   The primary source for all other properties.
    *   Whether to enable "Additive Merge" to pull in unique properties from the secondary source.
    *   Which specific "Other Properties" to include in the final output.
8.  **Manage Settings (Optional)**: In **Section 3.5**, you can save your current configuration to a file for later use or load a previously saved configuration.
9.  **Fuse & Download**: In **Section 4**, click the "Fuse GeoJSON Files" button. Once processing is complete, you can download the final, merged GeoJSON file.

---

## ✍️ Auteur

Cet outil a été réalisé par **Fred Neau** - **NOUS – Ouvert, Utile et Simple**.

-   **Site web**: [https://www.avecnous.eu/](https://www.avecnous.eu/)

---

## 📄 License

This project is licensed under the **GNU Affero General Public License v3.0**.

See the [LICENSE](https://www.gnu.org/licenses/agpl-3.0.en.html) file or website for full details. In short, this means you are free to use, modify, and distribute this software, but if you run a modified version on a network server, you must also make the source code of your modified version available to its users.

---

## 🛠️ Project Structure

```
/
├── public/
│   ├── data/
│   │   ├── manifest.json         # Lists available GeoJSON files
│   │   └── *.geojson             # Your GeoJSON data files
│   └── ...
├── src/
│   ├── components/               # React UI components
│   ├── services/                 # Core application logic
│   │   └── geojsonService.ts     # Analysis and merging algorithms
│   ├── types.ts                  # TypeScript type definitions for the app
│   ├── App.tsx                   # Main application component (state management)
│   └── index.tsx                 # React entry point
├── index.html                    # Main HTML file
└── readme.md                     # This file
```

---

## 💻 Technical Stack

*   **Framework**: [React](https://reactjs.org/)
*   **Language**: [TypeScript](https://www.typescriptlang.org/)
*   **Styling**: [Tailwind CSS](https://tailwindcss.com/)
*   **Build/Dev**: Powered by a framework that supports ES modules directly in the browser (like Vite or similar modern dev servers).

This is a self-contained frontend application and does not require a backend. All data fetching and processing happens client-side.
