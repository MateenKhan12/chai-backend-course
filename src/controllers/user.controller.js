import {asyncHandler} from "../utils/asyncHandler.js";
import {User} from "../models/user.model.js";
import {ApiError} from "../utils/ApiError.js";
import {uploadToCloudinary} from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";


const registerUser = asyncHandler(async (req, res) => {
    //get user details from frontend postman request
    //validation - not empty
    //check if user already exists: username or email
    //check for images, check for avatar
    //upload them to cloudinary
    //create user object - create entry in database
    // remove password and refresh token field from  reponse
    //check for user creation response
    //return response

    const { fullName, username, email, password } = req.body;
    console.log("email:", email); 

    if (
        [fullName, username, email, password].some((field) => field?.trim() === "")
    ){
        throw new ApiError("All fields are required", 400);
    }

   const existedUser =  User.findOne({
        $or: [{username}, {email}]
    })
    if(existedUser){
        throw new ApiError("User already exists", 409);
    }

    const avatarLocalPath = req.files?.avatar[0]?.path;
    const coverImageLocalPath = req.files?.coverImage[0]?.path; 

    if(!avatarLocalPath) {
        throw new ApiError("Avatar image is required", 400);
    }

    const avatar = await uploadToCloudinary(avatarLocalPath, "avatar");
    const coverImage = await uploadToCloudinary(coverImageLocalPath, "coverImage");

    if(!avatar) {
        throw new ApiError("Failed to upload avatar image", 400);
    }

   const user = await User.create({
        fullName,
        username: username.toLowerCase(),
        email,  
        password,
        avatar: avatar.url,
        coverImage: coverImage.url,
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken "
    )

    if(!createdUser){
        throw new ApiError("Failed to create user", 500);
    }

    return res.status(201).json(
        new ApiResponse(200, "User registered successfully", createdUser)
    );
}) 

export { registerUser };