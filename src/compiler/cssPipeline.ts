import postcss, { type AtRule, type Declaration, type Rule } from "postcss";
import selectorParser from "postcss-selector-parser";
import type { SanitizationOptions } from "../types.js";

function validateAtRule(atRule: AtRule, options: SanitizationOptions): void {
  if (!options.allowedAtRules.includes(atRule.name)) {
    throw new Error(`Disallowed at-rule: @${atRule.name}`);
  }
}

function validateDeclaration(decl: Declaration, options: SanitizationOptions): void {
  const prop = decl.prop.toLowerCase();
  if (!options.allowedProperties.includes(prop)) {
    throw new Error(`Disallowed CSS property: ${decl.prop}`);
  }

  const value = decl.value.toLowerCase();
  if (/expression\s*\(/i.test(value)) {
    throw new Error(`Disallowed CSS expression() usage in property: ${decl.prop}`);
  }

  if (/javascript\s*:/i.test(value)) {
    throw new Error(`Disallowed javascript: protocol in property: ${decl.prop}`);
  }

  const hasUrl = /url\s*\(/i.test(value);
  if (hasUrl && !options.allowDataUrls) {
    throw new Error(`Disallowed url() usage in property: ${decl.prop}`);
  }

  if (hasUrl && options.allowDataUrls && !/url\s*\(\s*['\"]?data:/i.test(value)) {
    throw new Error(`Only data: URLs are allowed in property: ${decl.prop}`);
  }
}

export function sanitizeCss(inputCss: string, options: SanitizationOptions): string {
  const root = postcss.parse(inputCss);

  root.walkAtRules((atRule) => {
    validateAtRule(atRule, options);
  });

  root.walkDecls((decl) => {
    validateDeclaration(decl, options);
  });

  return root.toString();
}

export function scopeSelectors(
  css: string,
  nameForLocal: (local: string) => string,
): { css: string; classes: Record<string, string> } {
  const root = postcss.parse(css);
  const classes = new Map<string, string>();

  const transformSelector = selectorParser((selectors) => {
    selectors.walkClasses((classNode) => {
      const local = classNode.value;
      if (!classes.has(local)) {
        classes.set(local, nameForLocal(local));
      }
      classNode.value = classes.get(local) ?? local;
    });
  });

  root.walkRules((rule: Rule) => {
    if (!rule.selector) {
      return;
    }
    rule.selector = transformSelector.processSync(rule.selector);
  });

  const classMap = Object.fromEntries(
    [...classes.entries()].sort(([a], [b]) => a.localeCompare(b)),
  );

  return {
    css: root.toString(),
    classes: classMap,
  };
}
