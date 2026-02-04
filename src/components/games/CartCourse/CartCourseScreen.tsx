/**
 * Cart Course Screen
 * Screen wrapper for the Cart Course game
 */

import React from "react";
import { StatusBar, StyleSheet, View } from "react-native";
import { CartCourse } from "./index";

// ============================================
// Cart Course Screen Component
// ============================================

export const CartCourseScreen: React.FC = () => {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a2e" />
      <CartCourse />
    </View>
  );
};

// ============================================
// Styles
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a2e",
  },
});

export default CartCourseScreen;
