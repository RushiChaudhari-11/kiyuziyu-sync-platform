package com.kiyuziyu.api.util;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Robust parser for Shopify SKUs and variant suffixes.
 * Safely parses trailing variant index suffixes like "-1", "-2", " - 3"
 * even when the base product code itself contains punctuation, slashes, or hyphens
 * (e.g., "A-3/ 3 in 1 colour rings-1").
 */
public class ShopifySkuParser {

    // Matches trailing numeric variant suffix at the end of the SKU:
    // e.g., "A-3/ 3 in 1 colour rings-1" -> group(1)="A-3/ 3 in 1 colour rings", group(2)="1"
    private static final Pattern SUFFIX_PATTERN = Pattern.compile("^(.*?)(?:\\s*-\\s*(\\d+))$");

    public static class SkuParseResult {
        private final String originalSku;
        private final String baseProductCode;
        private final int variantIndex; // 0-based index (-1 if non-variant)

        public SkuParseResult(String originalSku, String baseProductCode, int variantIndex) {
            this.originalSku = originalSku;
            this.baseProductCode = baseProductCode;
            this.variantIndex = variantIndex;
        }

        public String getOriginalSku() {
            return originalSku;
        }

        public String getBaseProductCode() {
            return baseProductCode;
        }

        public int getVariantIndex() {
            return variantIndex;
        }

        public boolean hasVariantSuffix() {
            return variantIndex >= 0;
        }

        @Override
        public String toString() {
            return "SkuParseResult{" +
                    "originalSku='" + originalSku + '\'' +
                    ", baseProductCode='" + baseProductCode + '\'' +
                    ", variantIndex=" + variantIndex +
                    '}';
        }
    }

    /**
     * Parse an incoming SKU into base product code and 0-based variant index.
     */
    public static SkuParseResult parse(String sku) {
        if (sku == null || sku.trim().isEmpty()) {
            return new SkuParseResult(sku, "", -1);
        }
        String cleanSku = sku.trim();
        Matcher matcher = SUFFIX_PATTERN.matcher(cleanSku);
        if (matcher.matches()) {
            String base = matcher.group(1).trim();
            int oneBasedIndex = -1;
            try {
                oneBasedIndex = Integer.parseInt(matcher.group(2).trim());
            } catch (NumberFormatException ignored) {}

            int zeroBasedIndex = oneBasedIndex > 0 ? (oneBasedIndex - 1) : -1;
            return new SkuParseResult(cleanSku, base, zeroBasedIndex);
        }

        return new SkuParseResult(cleanSku, cleanSku, -1);
    }

    /**
     * Check if an incoming SKU corresponds to a master productCode.
     * Compares normalized forms, parsed base code equality, and safe prefix matching.
     */
    public static boolean matchesBaseProductCode(String sku, String productCode) {
        if (sku == null || productCode == null) return false;
        String normSku = normalize(sku);
        String normCode = normalize(productCode);
        if (normSku.isEmpty() || normCode.isEmpty()) return false;

        // Exact match
        if (normSku.equalsIgnoreCase(normCode)) return true;

        // Compare parsed base code with product code
        SkuParseResult parsed = parse(sku);
        if (normalize(parsed.getBaseProductCode()).equalsIgnoreCase(normCode)) {
            return true;
        }

        // Prefix check with trailing hyphen + digit
        if (normSku.toLowerCase().startsWith(normCode.toLowerCase())) {
            String remainder = normSku.substring(normCode.length()).trim();
            if (remainder.matches("^-\\s*\\d+$")) {
                return true;
            }
        }
        return false;
    }

    /**
     * Normalize string by trimming and collapsing multiple spaces into a single space.
     */
    public static String normalize(String s) {
        if (s == null) return "";
        return s.trim().replaceAll("\\s+", " ");
    }
}
