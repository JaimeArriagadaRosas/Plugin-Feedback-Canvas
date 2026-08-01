export default class CourseFacade {
  constructor(adapter) {
    this.adapter = adapter;
  }

  async getCourses(teacherId) {
    return this.adapter._fetchAllWithToken('/users/self/courses?enrollment_type=teacher&per_page=50', teacherId);
  }

  async getStudents(courseId, teacherId) {
    return this.adapter._fetchAllWithToken(`/courses/${courseId}/users?enrollment_type[]=student&per_page=50`, teacherId);
  }

  async getTeachers(courseId, teacherId) {
    return this.adapter._fetchAllWithToken(`/courses/${courseId}/users?enrollment_type[]=teacher&per_page=50`, teacherId);
  }
}
