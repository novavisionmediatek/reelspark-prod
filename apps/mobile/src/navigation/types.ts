import type { NavigatorScreenParams } from '@react-navigation/native';

export type AuthStackParamList = {
  Welcome: undefined;
  SignUp: undefined;
  Login: undefined;
  ForgotPassword: undefined;
  CompleteProfile: undefined;
};

export type MainTabParamList = {
  Feed: undefined;
  Submit: undefined;
  MyVideos: undefined;
  Profile: undefined;
};

export type MainStackParamList = {
  Tabs: NavigatorScreenParams<MainTabParamList> | undefined;
  Payment: undefined;
};

export type ProfileStackParamList = {
  ProfileHome: undefined;
  EditProfile: undefined;
  ReferralWallet: undefined;
  AccountSettings: undefined;
  Notifications: undefined;
  HelpSupport: undefined;
};
