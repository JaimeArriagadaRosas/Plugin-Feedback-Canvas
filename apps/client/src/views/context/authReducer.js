export const initialState = {
  role: null,
  rawRoles: [],
  user: null,
  userName: null,
  courseId: null,
  selectedCourse: null,
  isLoading: true,
  apiError: null,
};

export function authReducer(state, action) {
  switch (action.type) {
    case 'LOGIN_SUCCESS':
      return {
        ...state,
        role: action.payload.role,
        rawRoles: action.payload.roles || [],
        user: action.payload.user,
        userName: action.payload.userName,
        courseId: action.payload.courseId,
        courseName: action.payload.courseName,
        studentId: action.payload.studentId,
        apiError: null,
        isLoading: false,
      };
    case 'LOGIN_ERROR':
      return {
        ...state,
        apiError: action.payload,
        role: null,
        rawRoles: [],
        user: null,
        courseId: null,
        isLoading: false,
      };
    case 'LOGOUT':
      return {
        ...initialState,
        isLoading: false,
      };
    case 'SET_SELECTED_COURSE':
      return {
        ...state,
        selectedCourse: action.payload,
      };
    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
      };
    default:
      return state;
  }
}
