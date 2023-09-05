import { Component } from '@angular/core';
import { Task } from '../app/model/task';
import { CdkDragDrop, transferArrayItem } from '@angular/cdk/drag-drop';
import { MatDialog } from '@angular/material/dialog';
import { TaskDialogComponent, TaskDialogResult } from './task-dialog/task-dialog.component';
import { Firestore, addDoc, collection, deleteDoc, doc, getDocs, updateDoc } from '@angular/fire/firestore';
import { v4 as uuidv4 } from 'uuid';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'kanban-app';
  todo: Task[] = [];
  inProgress: Task[] = [];
  done: Task[] = [];
  constructor(private dialog: MatDialog, private db: Firestore, private snackBar: MatSnackBar) {
    this.fetchTasks();
  }
  async fetchTasks(): Promise<void> {
    try {
      const tasksCollection = collection(this.db, 'tasks'); // Reference to the 'tasks' collection
      const querySnapshot = await getDocs(tasksCollection);
      const tasks: Task[] = [];

      querySnapshot.forEach((doc) => {
        const task = doc.data() as Task;
        task.id = doc.id;
        tasks.push(task);
      });

      // Assign the tasks to the appropriate arrays based on their status
      this.todo = tasks.filter((task) => task.status === 'todo');
      this.inProgress = tasks.filter((task) => task.status === 'inProgress');
      this.done = tasks.filter((task) => task.status === 'done');
      this.snackBar.open('Tasks fetched successfully.', 'Dismiss', {
        duration: 3000, // Adjust the duration as needed
        verticalPosition: 'bottom', // Position the snackbar at the bottom
      });
      // console.log('Tasks fetched successfully.');
    } catch (error) {
      // console.error('Error fetching tasks:', error);
      this.snackBar.open('Error fetching tasks:', 'Dismiss', {
        duration: 3000, // Adjust the duration as needed
        verticalPosition: 'bottom',
        panelClass: 'snackbar-error',// Position the snackbar at the bottom
      });
    }
  }

  editTask(list: 'done' | 'todo' | 'inProgress', task: Task): void {
    const dialogRef = this.dialog.open(TaskDialogComponent, {
      width: '500px',
      data: {
        task: { ...task }, // Create a copy of the task to avoid modifying it directly
        enableDelete: true,
      },
    });

    dialogRef.afterClosed().subscribe(async (result: TaskDialogResult | undefined) => {
      if (!result) {
        return;
      }

      const dataList = this[list];
      const taskIndex = dataList.findIndex((t) => t.id === task.id);

      if (result.delete) {
        // Delete the task from Firestore
        const taskDocRef = doc(this.db, 'tasks/' + task.id);
        try {
          await deleteDoc(taskDocRef);
          // Remove the task from the local array
          dataList.splice(taskIndex, 1);
          this.snackBar.open('Task deleted successfully.', 'Dismiss', {
            duration: 3000,
            verticalPosition: 'bottom',
          });
        } catch (error) {
          console.error('Error deleting task:', error);
          this.snackBar.open('Error deleting task.', 'Dismiss', {
            duration: 3000,
            verticalPosition: 'bottom',
            panelClass: 'snackbar-error',
          });
        }
      } else {
        // Update the task in Firestore
        const taskDocRef = doc(this.db, 'tasks/' + task.id);
        const taskUpdate = {
          title: result.task.title,
          description: result.task.description,
          status: result.task.status,
        };
        try {
          await updateDoc(taskDocRef, taskUpdate);
          // Update the local array with the edited task
          dataList[taskIndex] = result.task;
          this.snackBar.open('Task updated successfully.', 'Dismiss', {
            duration: 3000,
            verticalPosition: 'bottom',
          });
        } catch (error) {
          console.error('Error updating task:', error);
          this.snackBar.open('Error updating task.', 'Dismiss', {
            duration: 3000,
            verticalPosition: 'bottom',
            panelClass: 'snackbar-error',
          });
        }
      }
    });
  }


  // drop(event: CdkDragDrop<Task[]>): void {
  //   if (event.previousContainer === event.container) {
  //     return;
  //   }
  //   if (!event.container.data || !event.previousContainer.data) {
  //     return;
  //   }
  //   transferArrayItem(
  //     event.previousContainer.data,
  //     event.container.data,
  //     event.previousIndex,
  //     event.currentIndex
  //   );
  // }
  async drop(event: CdkDragDrop<Task[]>): Promise<void> {
    if (event.previousContainer === event.container) {
      return;
    }
  
    const task = event.previousContainer.data[event.previousIndex];
    const fromStatus = event.previousContainer.id;
    const toStatus = event.container.id;
  
    // Update the status of the task in Firestore
    const taskDocRef = doc(this.db, 'tasks/'+ task.id);
    try {
      await updateDoc(taskDocRef, { status: toStatus });
      this.snackBar.open('Task status updated successfully.', 'Dismiss', {
        duration: 3000,
        verticalPosition: 'bottom',
      });
    } catch (error) {
      console.error('Error updating task status:', error);
      this.snackBar.open('Error updating task status.', 'Dismiss', {
        duration: 3000,
        verticalPosition: 'bottom',
        panelClass: 'snackbar-error',
      });
    }
  
    // Perform the drag-and-drop operation
    transferArrayItem(
      event.previousContainer.data,
      event.container.data,
      event.previousIndex,
      event.currentIndex
    );
  }
  
  async newTask() {
    const dialogRef = this.dialog.open(TaskDialogComponent, {
      width: '500px',
      data: {
        task: {
          id: uuidv4(),
          title: '', // Set the default title or leave it empty
          description: '', // Set the default description or leave it empty
          status: 'todo', // Set the default status to 'todo'
        },
        enableDelete: true,
      },
    });

    dialogRef
      .afterClosed()
      .subscribe(async (result: TaskDialogResult | undefined) => {
        if (!result) {
          return;
        }
        // Check if both title and description are empty before adding to Firestore
        if (!result.task.title && !result.task.description) {
          console.log('Task creation canceled.');
          return;
        }
        // Add the new task to Firestore
        try {
          const tasksCollection = collection(this.db, 'tasks');
          const newTaskDocument = await addDoc(tasksCollection, result.task);
          result.task.id = newTaskDocument.id;
          this.fetchTasks();
          // console.log('New task added successfully.');
          this.snackBar.open('New task added successfully.', 'Dismiss', {
            duration: 3000,
            verticalPosition: 'bottom',
          });
        } catch (error) {
          // console.error('Error adding new task:', error);
          this.snackBar.open('Error adding new task.', 'Dismiss', {
            duration: 3000,
            verticalPosition: 'bottom',
            panelClass: 'snackbar-error',
          });
        }
      });
  }

}
