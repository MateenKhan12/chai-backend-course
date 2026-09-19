import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

const generateAccessAndRefreshTokens = async (userId) => {
    try {
        const user = await User.findById(userId);

        if (!user) {
            throw new ApiError(404, "User not found");
        }

        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken;

        await user.save({ validateBeforeSave: false });

        return { accessToken, refreshToken };

    } catch (error) {
        console.log("TOKEN GENERATION ERROR:", error);

        throw new ApiError(
            500,
            error?.message || "Failed to generate access and refresh tokens"
        );
    }
};
const registerUser = asyncHandler(async (req, res) => {

    // Get user details from frontend/Postman
    const { fullName, username, email, password } = req.body;

    console.log("BODY:", req.body);
    console.log("FILES:", req.files);
    console.log("email:", email);

    // Validation
    if (
        [fullName, username, email, password]
            .some((field) => field?.trim() === "")
    ) {
        throw new ApiError(400, "All fields are required");
    }

    // Check if user already exists
    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    });

    if (existedUser) {
        throw new ApiError(409, "User already exists");
    }

    // Get image paths from Multer
    const avatarLocalPath = req.files?.avatar?.[0]?.path;
    const coverImageLocalPath = req.files?.coverImage?.[0]?.path;

    console.log("Avatar local path:", avatarLocalPath);
    console.log("Cover image local path:", coverImageLocalPath);

    // Avatar is required
    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar image is required");
    }

    // Upload images to Cloudinary
    const avatar = await uploadOnCloudinary(avatarLocalPath);

    const coverImage = coverImageLocalPath
        ? await uploadOnCloudinary(coverImageLocalPath)
        : null;

    // Check avatar upload
    if (!avatar) {
        throw new ApiError(400, "Failed to upload avatar image");
    }

    // Create user
    const user = await User.create({
        fullName,
        username: username.toLowerCase(),
        email,
        password,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
    });

    // Remove password and refresh token
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    );

    if (!createdUser) {
        throw new ApiError(500, "Failed to create user");
    }

    return res.status(201).json(
        new ApiResponse(
            201,
            "User registered successfully",
            createdUser
        )
    );
});

const loginUser = asyncHandler(async (req, res) => {
    //req body -> data
    // username or email
    // find user 
    // passwprd check 
    // access and refresh token generate
    //send cookie

    const {email, username, password} = req.body;
    console.log(email);
    if(!username && !email) {
        throw new ApiError(400, "Username or email is required");
    }
     
    const user = await User.findOne({ $or: [{username}, {email}]
    });

    if(!user) {
        throw new ApiError(404, "User not found");
    }

    const isPasswordValid = await user.isPasswordCorrect(password);

    if(!isPasswordValid) {
        throw new ApiError(401, "Invalid password");
    }

   const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id);

   const loggedInUser = await User.findById(user._id).select("-password -refreshToken");

   const options ={
    httpOnly: true,
    secure: true
   }
   return res
   .status(200)
   .cookie("accessToken", accessToken, options)
   .cookie("refreshToken", refreshToken, options)
   .json(
        new ApiResponse(
            200,
            {
               user: loggedInUser,
                accessToken,
                refreshToken
            },
            "User logged in successfully"
            
        )
   )
})

const logoutUser = asyncHandler(async (req, res) => {
     await User.findByIdAndUpdate(
        req.user._id, 
        { $set:{ 
            refreshToken: undefined 
        } 
    }, 
        {
             new: true 
            });
            const options = {
                httpOnly: true,
                secure: true,   
            }
            return res
            .status(200)
            .clearCookie("accessToken", options)
            .clearCookie("refreshToken", options)
            .json(new ApiResponse(200, {}, "User logged out successfully"));
})

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;
    if (!incomingRefreshToken) {
        throw new ApiError(401, "Refresh token is required");
    }

    try {
    const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);
    const user = await User.findById(decodedToken?._id);
    if (!user) {
        throw new ApiError(401, "Invalid refresh token");
    }

    if(incomingRefreshToken !== user.refreshToken) {
        throw new ApiError(401, "Refresh token does not match");
    }

    const options = {
        httpOnly: true,
        secure: true
    }
    const { accessToken, newRefreshToken } = await generateAccessAndRefreshTokens(user._id);
    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newRefreshToken, options)
        .json(
            new ApiResponse(
                200,
                {
                    accessToken,
                    refreshToken: newRefreshToken
                },
                "Access token refreshed successfully"
            )
        );
    } catch (error) {
        console.log("REFRESH TOKEN ERROR:", error);
        throw new ApiError(401, "Invalid refresh token");
    }
});
export { registerUser, loginUser, logoutUser, refreshAccessToken };