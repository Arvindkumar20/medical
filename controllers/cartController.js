import {Cart} from "../models/Cart.js";
import {Product} from "../models/Product.js";
import {User} from "../models/User.js";
import {Coupon} from "../models/Coupon.js"; // Assuming you have a Coupon model

/**
 * @desc    Get user's cart
 * @route   GET /api/cart
 * @access  Private
 */
export const getCart = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const cart = await Cart.findByUserId(userId)
      .populate("items.product", "name price images inventory status slug")
      .populate("user", "name email");
    
    if (!cart) {
      return res.status(200).json({
        success: true,
        data: {
          items: [],
          totalPrice: 0,
          totalItems: 0,
          discountAmount: 0,
          discountedTotal: 0
        },
        message: "Cart is empty"
      });
    }
    
    res.status(200).json({
      success: true,
      data: cart
    });
  } catch (error) {
    console.error("Get Cart Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while retrieving cart"
    });
  }
};

/**
 * @desc    Add item to cart
 * @route   POST /api/cart/items
 * @access  Private
 */
export const addItemToCart = async (req, res) => {
  try {
    const { productId, quantity = 1 } = req.body;
    const userId = req.user.id;
    
    // Input validation
    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "Product ID is required"
      });
    }
    
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be an integer between 1 and 100"
      });
    }
    
    // Get product details
    const product = await Product.findById(productId);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }
    
    if (product.status !== "active") {
      return res.status(400).json({
        success: false,
        message: "Product is not available"
      });
    }
    
    if (product.inventory < quantity) {
      return res.status(400).json({
        success: false,
        message: `Only ${product.inventory} items available in stock`
      });
    }
    
    // Find or create cart for user
    let cart = await Cart.findOne({ user: userId });
    
    if (!cart) {
      cart = new Cart({
        user: userId,
        items: [],
        status: "active"
      });
    }
    
    // Add item to cart
    await cart.addItem(productId, quantity, product.price);
    
    // Populate the updated cart
    const updatedCart = await Cart.findByUserId(userId)
      .populate("items.product", "name price images inventory status slug");
    
    res.status(200).json({
      success: true,
      data: updatedCart,
      message: "Item added to cart successfully"
    });
  } catch (error) {
    console.error("Add to Cart Error:", error);
    
    if (error.message.includes("Maximum quantity") || 
        error.message.includes("Insufficient inventory") ||
        error.message.includes("cannot have more than")) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: "Server error while adding item to cart"
    });
  }
};

/**
 * @desc    Update item quantity in cart
 * @route   PUT /api/cart/items/:productId
 * @access  Private
 */
export const updateCartItem = async (req, res) => {
  try {
    const { productId } = req.params;
    const { quantity } = req.body;
    const userId = req.user.id;
    
    // Input validation
    if (!quantity || !Number.isInteger(quantity) || quantity < 0) {
      return res.status(400).json({
        success: false,
        message: "Valid quantity is required"
      });
    }
    
    if (quantity > 100) {
      return res.status(400).json({
        success: false,
        message: "Maximum quantity per product is 100"
      });
    }
    
    // Find user's cart
    const cart = await Cart.findOne({ user: userId });
    
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found"
      });
    }
    
    // Check if product exists in cart
    const itemExists = cart.items.some(
      item => item.product.toString() === productId
    );
    
    if (!itemExists) {
      return res.status(404).json({
        success: false,
        message: "Product not found in cart"
      });
    }
    
    // Check product inventory if increasing quantity
    if (quantity > 0) {
      const product = await Product.findById(productId);
      if (product.inventory < quantity) {
        return res.status(400).json({
          success: false,
          message: `Only ${product.inventory} items available in stock`
        });
      }
    }
    
    // Update or remove item
    if (quantity === 0) {
      await cart.removeItem(productId);
    } else {
      // First remove the item, then add with new quantity
      await cart.removeItem(productId);
      
      const product = await Product.findById(productId);
      await cart.addItem(productId, quantity, product.price);
    }
    
    // Get updated cart
    const updatedCart = await Cart.findByUserId(userId)
      .populate("items.product", "name price images inventory status slug");
    
    res.status(200).json({
      success: true,
      data: updatedCart,
      message: quantity === 0 ? 
        "Item removed from cart" : 
        "Cart item updated successfully"
    });
  } catch (error) {
    console.error("Update Cart Error:", error);
    
    if (error.message.includes("Product not found in cart")) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: "Server error while updating cart item"
    });
  }
};

/**
 * @desc    Remove item from cart
 * @route   DELETE /api/cart/items/:productId
 * @access  Private
 */
export const removeItemFromCart = async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user.id;
    
    // Find user's cart
    const cart = await Cart.findOne({ user: userId });
    
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found"
      });
    }
    
    // Remove item from cart
    await cart.removeItem(productId);
    
    // Get updated cart
    const updatedCart = await Cart.findByUserId(userId)
      .populate("items.product", "name price images inventory status slug");
    
    res.status(200).json({
      success: true,
      data: updatedCart,
      message: "Item removed from cart successfully"
    });
  } catch (error) {
    console.error("Remove from Cart Error:", error);
    
    if (error.message.includes("Product not found in cart")) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: "Server error while removing item from cart"
    });
  }
};

/**
 * @desc    Clear entire cart
 * @route   DELETE /api/cart
 * @access  Private
 */
export const clearCart = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Find user's cart
    const cart = await Cart.findOne({ user: userId });
    
    if (!cart || cart.items.length === 0) {
      return res.status(200).json({
        success: true,
        message: "Cart is already empty"
      });
    }
    
    // Clear cart
    await cart.clearCart();
    
    res.status(200).json({
      success: true,
      message: "Cart cleared successfully"
    });
  } catch (error) {
    console.error("Clear Cart Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while clearing cart"
    });
  }
};

/**
 * @desc    Apply coupon to cart
 * @route   POST /api/cart/coupon
 * @access  Private
 */
export const applyCoupon = async (req, res) => {
  try {
    const { couponCode } = req.body;
    const userId = req.user.id;
    
    if (!couponCode) {
      return res.status(400).json({
        success: false,
        message: "Coupon code is required"
      });
    }
    
    // Find user's cart
    const cart = await Cart.findOne({ user: userId });
    
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Cart is empty"
      });
    }
    
    // Validate coupon (in a real implementation, you'd check against a Coupon model)
    const coupon = await Coupon.findOne({ 
      code: couponCode.toUpperCase(),
      isActive: true,
      validFrom: { $lte: new Date() },
      validUntil: { $gte: new Date() }
    });
    
    if (!coupon) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired coupon code"
      });
    }
    
    // Check if coupon applies to any products in cart
    const applicableItems = coupon.appliesTo === 'all' ? 
      cart.items : 
      cart.items.filter(item => 
        coupon.applicableProducts.includes(item.product.toString())
      );
    
    if (applicableItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Coupon not applicable to any items in your cart"
      });
    }
    
    // Calculate discount based on coupon type
    let discountAmount = 0;
    
    if (coupon.discountType === 'percentage') {
      const applicableTotal = applicableItems.reduce(
        (sum, item) => sum + (item.price * item.quantity), 0
      );
      discountAmount = applicableTotal * (coupon.discountValue / 100);
      
      // Apply maximum discount if specified
      if (coupon.maxDiscount && discountAmount > coupon.maxDiscount) {
        discountAmount = coupon.maxDiscount;
      }
    } else if (coupon.discountType === 'fixed') {
      discountAmount = coupon.discountValue;
    }
    
    // Apply discount
    cart.couponCode = couponCode;
    cart.discountAmount = Math.min(discountAmount, cart.totalPrice);
    
    await cart.save();
    
    // Get updated cart
    const updatedCart = await Cart.findByUserId(userId)
      .populate("items.product", "name price images inventory status slug");
    
    res.status(200).json({
      success: true,
      data: updatedCart,
      message: "Coupon applied successfully"
    });
  } catch (error) {
    console.error("Apply Coupon Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while applying coupon"
    });
  }
};

/**
 * @desc    Remove coupon from cart
 * @route   DELETE /api/cart/coupon
 * @access  Private
 */
export const removeCoupon = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Find user's cart
    const cart = await Cart.findOne({ user: userId });
    
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found"
      });
    }
    
    if (!cart.couponCode) {
      return res.status(400).json({
        success: false,
        message: "No coupon applied to cart"
      });
    }
    
    // Remove coupon
    await cart.removeCoupon();
    
    // Get updated cart
    const updatedCart = await Cart.findByUserId(userId)
      .populate("items.product", "name price images inventory status slug");
    
    res.status(200).json({
      success: true,
      data: updatedCart,
      message: "Coupon removed successfully"
    });
  } catch (error) {
    console.error("Remove Coupon Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while removing coupon"
    });
  }
};

/**
 * @desc    Get cart summary (for quick display)
 * @route   GET /api/cart/summary
 * @access  Private
 */
export const getCartSummary = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const cart = await Cart.findOne({ user: userId });
    
    if (!cart || cart.items.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          totalItems: 0,
          totalPrice: 0,
          discountAmount: 0,
          discountedTotal: 0
        }
      });
    }
    
    res.status(200).json({
      success: true,
      data: {
        totalItems: cart.totalItems,
        totalPrice: cart.totalPrice,
        discountAmount: cart.discountAmount,
        discountedTotal: cart.discountedTotal
      }
    });
  } catch (error) {
    console.error("Cart Summary Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while retrieving cart summary"
    });
  }
};

/**
 * @desc    Merge guest cart with user cart after login
 * @route   POST /api/cart/merge
 * @access  Private
 */
export const mergeCarts = async (req, res) => {
  try {
    const userId = req.user.id;
    const { guestCart } = req.body;
    
    if (!guestCart || !guestCart.items || !Array.isArray(guestCart.items)) {
      return res.status(400).json({
        success: false,
        message: "Invalid guest cart data"
      });
    }
    
    // Get or create user cart
    let userCart = await Cart.findOne({ user: userId });
    
    if (!userCart) {
      userCart = new Cart({
        user: userId,
        items: [],
        status: "active"
      });
      await userCart.save();
    }
    
    // Merge guest cart items into user cart
    for (const item of guestCart.items) {
      try {
        // Check if product exists and is available
        const product = await Product.findById(item.product);
        
        if (product && product.inventory > 0) {
        // if (product && product.status === "active" && product.inventory > 0) {
          const quantity = Math.min(item.quantity, product.inventory);
          await userCart.addItem(item.product, quantity, product.price);
        }
      } catch (error) {
        // Skip invalid items and continue
        console.warn("Skipping invalid cart item during merge:", error.message);
      }
    }
    
    // Get updated cart
    const updatedCart = await Cart.findByUserId(userId)
      .populate("items.product", "name price images inventory status slug");
    
    res.status(200).json({
      success: true,
      data: updatedCart,
      message: "Cart merged successfully"
    });
  } catch (error) {
    console.error("Merge Cart Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while merging carts"
    });
  }
};